"use client"

import { useState } from "react"
import { Download, ArrowLeft, Eye, FileText, Edit2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { DocumentData } from "@/app/page"

interface DocumentPreviewProps {
  documentData: DocumentData
  onStartOver: () => void
}

export default function DocumentPreview({ documentData, onStartOver }: DocumentPreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [editingPlaceholder, setEditingPlaceholder] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [previewKey, setPreviewKey] = useState(0) // Force preview refresh

  const generateCompletedDocument = () => {
    let completedContent = documentData.originalContent

    console.log("Starting document replacement...")
    console.log("Original content length:", completedContent.length)
    console.log(
      "Placeholders to replace:",
      documentData.placeholders.map((p) => ({ text: p.text, value: p.value })),
    )

    // Sort placeholders by length (longest first) to avoid partial replacements
    const sortedPlaceholders = [...documentData.placeholders].sort((a, b) => b.text.length - a.text.length)

    // Replace all placeholders with their values
    sortedPlaceholders.forEach((placeholder) => {
      if (placeholder.value) {
        const value = placeholder.value
        console.log(`Replacing "${placeholder.text}" with "${value}"`)

        // Handle bracketed placeholders like [COMPANY NAME]
        if (placeholder.text.startsWith("[") && placeholder.text.endsWith("]")) {
          const escapedText = placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          const regex = new RegExp(escapedText)
          const beforeReplace = completedContent.length
          completedContent = completedContent.replace(regex, value)
          const afterReplace = completedContent.length
          console.log(`Bracket replacement: ${beforeReplace} -> ${afterReplace} chars`)
        }
        // Handle dollar placeholders like $[_____________]
        else if (placeholder.text.startsWith("$[")) {
          const escapedText = placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          const regex = new RegExp(escapedText)
          const beforeReplace = completedContent.length
          completedContent = completedContent.replace(regex, value)
          const afterReplace = completedContent.length
          console.log(`Dollar replacement: ${beforeReplace} -> ${afterReplace} chars`)
        }
        // Handle signature fields like "By: ____", "Name: ____", etc.
        else if (placeholder.text.includes(": ____")) {
          const fieldName = placeholder.text.replace(": ____", "")
          const replacementText = `${fieldName}: ${value}`

          // Try exact match first (most precise)
          const exactPattern = placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          const exactRegex = new RegExp(exactPattern)

          if (exactRegex.test(completedContent)) {
            completedContent = completedContent.replace(exactRegex, replacementText)
            console.log(`Exact signature field "${fieldName}" replaced`)
          } else {
            // Try alternative patterns only if exact match didn't work
            const patterns = [
              new RegExp(`${fieldName}:\\s*_{2,}`, "i"),
              new RegExp(`${fieldName}:\\s*[_\\s]*$`, "im"),
              new RegExp(`${fieldName}:\\s*$`, "im"),
            ]

            let replaced = false
            patterns.forEach((pattern, index) => {
              if (!replaced && pattern.test(completedContent)) {
                completedContent = completedContent.replace(pattern, replacementText)
                console.log(`Signature field "${fieldName}" replaced using pattern ${index + 1}`)
                replaced = true
              }
            })

            if (!replaced) {
              console.log(`Warning: Could not replace signature field "${fieldName}"`)
            }
          }
        }
        // Handle any other underscore patterns
        else if (placeholder.text.includes("____")) {
          const escapedText = placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          const regex = new RegExp(escapedText)
          const beforeReplace = completedContent.length
          completedContent = completedContent.replace(regex, value)
          const afterReplace = completedContent.length
          console.log(`Underscore replacement: ${beforeReplace} -> ${afterReplace} chars`)
        }
        // Fallback: try direct text replacement
        else {
          const escapedText = placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          const regex = new RegExp(escapedText)
          const beforeReplace = completedContent.length
          completedContent = completedContent.replace(regex, value)
          const afterReplace = completedContent.length
          console.log(`Direct replacement: ${beforeReplace} -> ${afterReplace} chars`)
        }
      }
    })

    console.log("Final content length:", completedContent.length)
    return completedContent
  }

  const handleEditStart = (placeholderId: string, currentValue: string) => {
    setEditingPlaceholder(placeholderId)
    setEditValue(currentValue)
  }

  const handleEditSave = (placeholderId: string) => {
    const placeholder = documentData.placeholders.find((p) => p.id === placeholderId)
    if (placeholder) {
      placeholder.value = editValue
      setEditingPlaceholder(null)
      setEditValue("")
      setPreviewKey((prev) => prev + 1) // Force preview refresh
    }
  }

  const handleEditCancel = () => {
    setEditingPlaceholder(null)
    setEditValue("")
  }

  // Helper function to download blob
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDownload = async () => {
    setIsDownloading(true)

    try {
      // If we have the original .docx file, process it with mammoth
      if (
        documentData.originalFile &&
        (documentData.originalFile.name.endsWith(".docx") || documentData.originalFile.name.endsWith(".doc"))
      ) {
        await downloadModifiedDocx()
      } else {
        // For text files, keep as text
        const completedContent = generateCompletedDocument()
        const blob = new Blob([completedContent], {
          type: "text/plain",
        })

        const nameWithoutExt = documentData.fileName.replace(/\.txt$/i, "")
        const fileName = `completed_${nameWithoutExt}.txt`

        downloadBlob(blob, fileName)
      }
    } catch (error) {
      console.error("Download failed:", error)
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadModifiedDocx = async () => {
    try {
      // Use mammoth to extract and then recreate the document
      try {
        const mammoth = await import("mammoth")

        // Read the original file as array buffer
        const arrayBuffer = await documentData.originalFile!.arrayBuffer()

        // Extract the raw text from the original document
        const result = await mammoth.extractRawText({ arrayBuffer })
        let documentText = result.value

        console.log("Original document text for download:", documentText.substring(0, 500))

        // Apply the same replacement logic as the preview
        documentData.placeholders.forEach((placeholder) => {
          if (placeholder.value) {
            const value = placeholder.value
            console.log(`Download: Replacing "${placeholder.text}" with "${value}"`)

            // Handle bracketed placeholders like [COMPANY NAME]
            if (placeholder.text.startsWith("[") && placeholder.text.endsWith("]")) {
              const escapedText = placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              documentText = documentText.replace(new RegExp(escapedText), value)
            }
            // Handle dollar placeholders like $[_____________]
            else if (placeholder.text.startsWith("$[")) {
              const escapedText = placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              documentText = documentText.replace(new RegExp(escapedText), value)
            }
            // Handle signature fields like "By: ____", "Name: ____", etc.
            else if (placeholder.text.includes(": ____")) {
              const fieldName = placeholder.text.replace(": ____", "");

              const underscorePattern = new RegExp(
                `${fieldName}:\\s*_{2,}`,          // "Email: ___"  (≥ 2 underscores)
                "i"
              );

              const blankPattern = new RegExp(`${fieldName}:\\s*(\\r?\\n)`, "im");

              let replaced = false;

              if (underscorePattern.test(documentText)) {
                documentText = documentText.replace(
                  underscorePattern,
                  `${fieldName}: ${value}`
                );
                replaced = true;
              }

              if (!replaced && blankPattern.test(documentText)) {
                documentText = documentText.replace(blankPattern, `${fieldName}: ${value}$1`);
              }
            }
            // else if (placeholder.text.includes(": ____")) {
            //   const fieldName = placeholder.text.replace(": ____", "")

            //   // Try multiple replacement patterns for signature fields
            //   const patterns = [
            //     new RegExp(placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
            //     new RegExp(`${fieldName}:\\s*_{2,}`, "i"),
            //     new RegExp(`${fieldName}:\\s*[_\\s]*$`, "im"),
            //     new RegExp(`${fieldName}:\\s*$`, "im"),
            //   ]

            //   patterns.forEach((pattern) => {
            //     documentText = documentText.replace(pattern, `${fieldName}: ${value}`)
            //   })
            // }
            // Handle any other underscore patterns
            else if (placeholder.text.includes("____")) {
              const escapedText = placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              documentText = documentText.replace(new RegExp(escapedText), value)
            }
            // Fallback: try direct text replacement
            else {
              const escapedText = placeholder.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              documentText = documentText.replace(new RegExp(escapedText), value)
            }
          }
        })

        console.log("Document text after replacement for download:", documentText.substring(0, 500))

        // Create a Word-compatible HTML document with the replaced content
        const htmlContent = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="utf-8">
  <title>Legal Document</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>90</w:Zoom>
      <w:DoNotPromptForConvert/>
      <w:DoNotShowInsertionsAndDeletions/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { 
      font-family: 'Times New Roman', serif; 
      font-size: 12pt; 
      line-height: 1.5; 
      margin: 1in; 
      color: black;
    }
    p { margin: 0 0 12pt 0; }
    .signature-line { 
      border-bottom: 1px solid black; 
      display: inline-block; 
      min-width: 200px; 
      height: 16px;
    }
  </style>
</head>
<body>
${documentText
  .split("\n")
  .map((line) => {
    return `<p>${line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")}</p>`
  })
  .join("")}
</body>
</html>`

        const blob = new Blob([htmlContent], {
          type: "application/msword",
        })

        const nameWithoutExt = documentData.fileName.replace(/\.(docx?|txt)$/i, "")
        const fileName = `completed_${nameWithoutExt}.doc`

        downloadBlob(blob, fileName)
        return
      } catch (mammothError) {
        console.log("Mammoth extraction failed, using preview content:", mammothError)
      }

      // Final fallback: Use the preview content (which we know works)
      const completedContent = generateCompletedDocument()

      // Create a Word-compatible HTML document
      const htmlContent = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="utf-8">
  <title>Legal Document</title>
  <style>
    body { 
      font-family: 'Times New Roman', serif; 
      font-size: 12pt; 
      line-height: 1.5; 
      margin: 1in; 
      color: black;
    }
    p { margin: 0 0 12pt 0; }
  </style>
</head>
<body>
${completedContent
  .split("\n")
  .map((line) => {
    return `<p>${line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")}</p>`
  })
  .join("")}
</body>
</html>`

      const blob = new Blob([htmlContent], {
        type: "application/msword",
      })

      const nameWithoutExt = documentData.fileName.replace(/\.(docx?|txt)$/i, "")
      const fileName = `completed_${nameWithoutExt}.doc`

      downloadBlob(blob, fileName)
    } catch (error) {
      console.error("Error processing docx:", error)
      throw error
    }
  }

  const completedContent = generateCompletedDocument()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold">Document Preview</h2>
            <p className="text-gray-600">Your document with all placeholders filled in</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onStartOver}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Start Over
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download Document
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Document Preview */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Completed Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white border rounded-lg p-6 max-h-[600px] overflow-y-auto">
                <pre key={previewKey} className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
                  {completedContent}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Original File</p>
                <p className="font-medium">{documentData.fileName}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Placeholders Filled</p>
                <p className="font-medium">
                  {documentData.placeholders.length} of {documentData.placeholders.length}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Download Format</p>
                <p className="font-medium">
                  {documentData.fileName.endsWith(".docx") || documentData.fileName.endsWith(".doc")
                    ? "Word Document (Compatible Format)"
                    : "Text File"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <Badge className="bg-green-100 text-green-800">Complete</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Filled Values
                <Badge variant="secondary" className="text-xs">
                  Click to edit
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {documentData.placeholders.map((placeholder) => (
                  <div
                    key={placeholder.id}
                    className="p-3 bg-gray-50 rounded border hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-600 font-medium">{placeholder.text}</p>
                      {editingPlaceholder !== placeholder.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditStart(placeholder.id, placeholder.value || "")}
                          className="h-6 w-6 p-0 hover:bg-blue-100"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    {editingPlaceholder === placeholder.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                          placeholder="Enter new value..."
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => handleEditSave(placeholder.id)} className="h-7 px-2 text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleEditCancel} className="h-7 px-2 text-xs">
                            <X className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs break-words max-w-full">
                          <span className="truncate">{placeholder.value}</span>
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Download Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button onClick={handleDownload} className="w-full" disabled={isDownloading}>
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Completed Document
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                {documentData.fileName.endsWith(".docx") || documentData.fileName.endsWith(".doc")
                  ? "Downloads as Word-compatible document"
                  : "Downloads as text file"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
