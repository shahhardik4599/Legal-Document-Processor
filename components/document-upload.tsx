"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { DocumentData, Placeholder } from "@/app/page"

interface DocumentUploadProps {
  onDocumentProcessed: (data: DocumentData) => void
}

export default function DocumentUpload({ onDocumentProcessed }: DocumentUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  const extractPlaceholdersFromDocx = async (file: File): Promise<{ text: string; placeholders: Placeholder[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer

          // Use mammoth to extract text from .docx
          const mammoth = await import("mammoth")
          const result = await mammoth.extractRawText({ arrayBuffer })
          const extractedText = result.value

          console.log("Extracted text from .docx:", extractedText.substring(0, 1000))
          console.log("Full extracted text length:", extractedText.length)

          // Extract placeholders from the text
          const placeholders: Placeholder[] = []
          const seenTextsWithPosition = new Set<string>()
          let id = 1

          // Pattern 1: Anything in square brackets [ANYTHING]
          const bracketPattern = /\[([^\]]+)\]/g
          let match1
          while ((match1 = bracketPattern.exec(extractedText)) !== null) {
            const fullText = match1[0]
            const innerText = match1[1]

            const isValid =
              innerText.length > 0 &&
              innerText.length < 100 &&
              /[a-zA-Z]/.test(innerText) &&
              !/[^\x20-\x7E]/.test(innerText)

            if (isValid) {
              const uniqueKey = `${fullText}_pos_${match1.index}`
              if (!seenTextsWithPosition.has(uniqueKey)) {
                seenTextsWithPosition.add(uniqueKey)
                placeholders.push({
                  id: `placeholder_${id++}`,
                  text: fullText,
                  description: `Please provide a value for: ${innerText}`,
                })
                console.log("Found bracket placeholder:", fullText)
              }
            }
          }

          // Pattern 2: Dollar amount placeholders like $[_____]
          const dollarPattern = /\$\[([^\]]*)\]/g
          let match2
          while ((match2 = dollarPattern.exec(extractedText)) !== null) {
            const fullText = match2[0]
            const uniqueKey = `${fullText}_pos_${match2.index}`
            if (!seenTextsWithPosition.has(uniqueKey)) {
              seenTextsWithPosition.add(uniqueKey)
              placeholders.push({
                id: `placeholder_${id++}`,
                text: fullText,
                description: `Please provide a dollar amount`,
              })
              console.log("Found dollar placeholder:", fullText)
            }
          }

          // Pattern 3: Traditional underscore patterns like "Name: ____" (ONLY if they actually exist)
          const underscorePattern = /([A-Za-z\s]+):\s*_{3,}/g
          let match3
          while ((match3 = underscorePattern.exec(extractedText)) !== null) {
            const fullText = match3[0]
            const uniqueKey = `${fullText}_pos_${match3.index}`
            if (!seenTextsWithPosition.has(uniqueKey)) {
              seenTextsWithPosition.add(uniqueKey)
              placeholders.push({
                id: `placeholder_${id++}`,
                text: fullText,
                description: `Please provide a value for: ${match3[1]}`,
              })
              console.log("Found traditional underscore placeholder:", fullText)
            }
          }

          // Pattern 4: Look for signature section patterns - but ONLY if they actually exist in the text
          // First, check if this looks like a document with a signature section
          const hasSignatureSection =
            extractedText.toLowerCase().includes("signature") ||
            extractedText.includes("INVESTOR:") ||
            extractedText.includes("COMPANY:")

          if (hasSignatureSection) {
            console.log("Document appears to have signature section, looking for signature fields...")

            // Look for actual signature field patterns that exist in the document
            const signatureFieldPatterns = [
              /^(\s*)(By):\s*[_\s]*$/gim,
              /^(\s*)(Name):\s*[_\s]*$/gim,
              /^(\s*)(Title):\s*[_\s]*$/gim,
              /^(\s*)(Address):\s*[_\s]*$/gim,
              /^(\s*)(Email):\s*[_\s]*$/gim,
            ]

            signatureFieldPatterns.forEach((pattern) => {
              let fieldMatch
              while ((fieldMatch = pattern.exec(extractedText)) !== null) {
                const fieldName = fieldMatch[2]
                const placeholderText = `${fieldName}: ____`

                const uniqueKey = `${placeholderText}_pos_${fieldMatch.index}`
                if (!seenTextsWithPosition.has(uniqueKey)) {
                  seenTextsWithPosition.add(uniqueKey)
                  placeholders.push({
                    id: `placeholder_${id++}`,
                    text: placeholderText,
                    description: `Please provide the ${fieldName.toLowerCase()}`,
                  })
                  console.log("Found signature field in document:", placeholderText)
                }
              }
            })

            // Look for lines that are mostly underscores (signature lines)
            const lines = extractedText.split("\n")
            lines.forEach((line, index) => {
              const trimmedLine = line.trim()

              // If line is mostly underscores
              if (trimmedLine.match(/^_{5,}$/)) {
                // Look at previous line for context
                const prevLine = index > 0 ? lines[index - 1]?.trim() : ""

                // Only create placeholder if previous line suggests it's a field
                if (prevLine.match(/^(By|Name|Title|Address|Email):\s*$/i)) {
                  const fieldName = prevLine.replace(":", "").trim()
                  const placeholderText = `${fieldName}: ____`

                  const uniqueKey = `${placeholderText}_line_${index}`
                  if (!seenTextsWithPosition.has(uniqueKey)) {
                    seenTextsWithPosition.add(uniqueKey)
                    placeholders.push({
                      id: `placeholder_${id++}`,
                      text: placeholderText,
                      description: `Please provide the ${fieldName.toLowerCase()}`,
                    })
                    console.log("Found signature field with underscore line:", placeholderText)
                  }
                }
              }
            })
          } else {
            console.log("Document does not appear to have signature section, skipping signature field detection")
          }

          console.log("Total placeholders found:", placeholders.length)
          console.log(
            "All placeholders:",
            placeholders.map((p) => p.text),
          )

          resolve({ text: extractedText, placeholders })
        } catch (err) {
          reject(err)
        }
      }

      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsArrayBuffer(file)
    })
  }

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content)
      }

      reader.onerror = () => {
        reject(new Error("Failed to read file"))
      }

      reader.readAsText(file)
    })
  }

  const extractPlaceholdersFromText = (content: string): Placeholder[] => {
    const placeholders: Placeholder[] = []
    const seenTextsWithPosition = new Set<string>()
    let id = 1

    // Pattern 1: Anything in square brackets [ANYTHING]
    const bracketPattern = /\[([^\]]+)\]/g
    let match1
    while ((match1 = bracketPattern.exec(content)) !== null) {
      const fullText = match1[0]
      const innerText = match1[1]

      const isValid =
        innerText.length > 0 && innerText.length < 100 && /[a-zA-Z]/.test(innerText) && !/[^\x20-\x7E]/.test(innerText)

      if (isValid) {
        const uniqueKey = `${fullText}_pos_${match1.index}`
        if (!seenTextsWithPosition.has(uniqueKey)) {
          seenTextsWithPosition.add(uniqueKey)
          placeholders.push({
            id: `placeholder_${id++}`,
            text: fullText,
            description: `Please provide a value for: ${innerText}`,
          })
        }
      }
    }

    // Pattern 2: Field with underscores like "Name: ____" (only if they actually exist)
    const underscorePattern = /([A-Za-z\s]+):\s*_{3,}/g
    let match2
    while ((match2 = underscorePattern.exec(content)) !== null) {
      const fullText = match2[0]
      const uniqueKey = `${fullText}_pos_${match2.index}`
      if (!seenTextsWithPosition.has(uniqueKey)) {
        seenTextsWithPosition.add(uniqueKey)
        placeholders.push({
          id: `placeholder_${id++}`,
          text: fullText,
          description: `Please provide a value for: ${match2[1]}`,
        })
      }
    }

    // Pattern 3: Dollar amount placeholders like $[_____]
    const dollarPattern = /\$\[([^\]]*)\]/g
    let match3
    while ((match3 = dollarPattern.exec(content)) !== null) {
      const fullText = match3[0]
      const uniqueKey = `${fullText}_pos_${match3.index}`
      if (!seenTextsWithPosition.has(uniqueKey)) {
        seenTextsWithPosition.add(uniqueKey)
        placeholders.push({
          id: `placeholder_${id++}`,
          text: fullText,
          description: `Please provide a dollar amount`,
        })
      }
    }

    return placeholders
  }

  const processFile = async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setDebugInfo(null)

    try {
      console.log("Processing file:", file.name, "Type:", file.type, "Size:", file.size)

      let extractedText: string
      let placeholders: Placeholder[]

      if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
        // Process .docx file directly
        setDebugInfo("Processing Word document - detecting only existing placeholders...")
        const result = await extractPlaceholdersFromDocx(file)
        extractedText = result.text
        placeholders = result.placeholders
      } else if (file.name.endsWith(".txt") || file.type === "text/plain") {
        // Text file - read directly
        extractedText = await readFileAsText(file)
        placeholders = extractPlaceholdersFromText(extractedText)
        setDebugInfo(`Text file processed. Length: ${extractedText.length} characters`)
      } else {
        // Other file types - try as text
        extractedText = await readFileAsText(file)
        placeholders = extractPlaceholdersFromText(extractedText)
        setDebugInfo(`File processed as text. Length: ${extractedText.length} characters`)
      }

      console.log("Found placeholders:", placeholders)

      if (placeholders.length === 0) {
        setError(
          `No placeholders found in your document. Make sure your document contains fields like [COMPANY NAME] or Name: ____. Found text sample: "${extractedText.substring(0, 200)}..."`,
        )
        setIsProcessing(false)
        return
      }

      const documentData: DocumentData = {
        originalContent: extractedText,
        placeholders,
        fileName: file.name,
        originalFile: file,
      }

      setTimeout(() => {
        onDocumentProcessed(documentData)
        setIsProcessing(false)
      }, 1500)
    } catch (err) {
      console.error("Processing error:", err)
      setError(`Failed to process document: ${err instanceof Error ? err.message : "Unknown error"}`)
      setIsProcessing(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      processFile(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
      "application/octet-stream": [".docx", ".doc"],
      "*/*": [],
    },
    maxFiles: 1,
  })

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Upload Legal Document
        </CardTitle>
        <CardDescription>
          Upload your .docx, .doc, or .txt file. Placeholders will be automatically detected in your document.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {debugInfo && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-sm font-medium text-green-700">{debugInfo}</AlertDescription>
          </Alert>
        )}

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
          } ${isProcessing ? "pointer-events-none opacity-50" : ""}`}
        >
          <input {...getInputProps()} />

          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />

          {isProcessing ? (
            <div>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium text-gray-700">Processing document...</p>
              <p className="text-sm text-gray-500">Detecting existing placeholders</p>
            </div>
          ) : isDragActive ? (
            <p className="text-lg font-medium text-blue-600">Drop the document here...</p>
          ) : (
            <div>
              <p className="text-lg font-medium text-gray-700 mb-2">
                Drag & drop your document here, or click to select
              </p>
              <p className="text-sm text-gray-500">Accurate placeholder detection</p>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-900 mb-2">✅ Smart placeholder detection!</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Detects only placeholders that actually exist in your document</li>
              <li>• Handles various formats: [brackets], $[amounts], Name: ____</li>
              <li>• Preserves original formatting in final document</li>
            </ul>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">📝 Supported formats:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <div className="font-mono bg-white p-2 rounded border">
                [COMPANY NAME] - Bracketed fields
                <br />
                $[Purchase Amount] - Dollar amounts
                <br />
                Name: ____ - Signature fields (if present)
                <br />
                Address: ____ - Contact fields (if present)
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
