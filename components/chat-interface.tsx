"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Send, FileText, ArrowLeft, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { DocumentData, Placeholder } from "@/app/page"

interface ChatInterfaceProps {
  documentData: DocumentData
  onComplete: () => void
  onStartOver: () => void
}

interface Message {
  id: string
  type: "bot" | "user"
  content: string
  placeholder?: Placeholder
}

export default function ChatInterface({ documentData, onComplete, onStartOver }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentInput, setCurrentInput] = useState("")
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Initialize chat with welcome message
    const welcomeMessage: Message = {
      id: "welcome",
      type: "bot",
      content: `Great! I've analyzed your document "${documentData.fileName}" and found ${documentData.placeholders.length} placeholders that need to be filled. Let's go through them one by one.`,
    }
    setMessages([welcomeMessage])

    // Start with first placeholder
    if (documentData.placeholders.length > 0) {
      setTimeout(() => askNextPlaceholder(0), 1000)
    }
  }, [])

  const askNextPlaceholder = (index: number) => {
    if (index >= documentData.placeholders.length) {
      // All placeholders filled, show summary
      setTimeout(() => showSummary(), 1000)
      return
    }

    const placeholder = documentData.placeholders[index]
    const questionMessage: Message = {
      id: `question_${index}`,
      type: "bot",
      content: `What should I put for "${placeholder.text}"? ${placeholder.description || ""}`,
      placeholder,
    }

    setMessages((prev) => [...prev, questionMessage])
  }

  const showSummary = () => {
    const summaryContent = documentData.placeholders.map((p) => `• ${p.text}: "${p.value}"`).join("\n")

    const summaryMessage: Message = {
      id: `summary_${Date.now()}`,
      type: "bot",
      content: `Perfect! I've collected all the information. Here's what you've entered:\n\n${summaryContent}\n\nDoes everything look correct? Type 'yes' to proceed, or tell me which field you'd like to change (e.g., "change company name").`,
    }
    setMessages((prev) => [...prev, summaryMessage])
    setShowFinalConfirmation(true)
  }

  const handleFieldEdit = (fieldName: string) => {
    const placeholder = documentData.placeholders.find(
      (p) =>
        p.text.toLowerCase().includes(fieldName.toLowerCase()) ||
        fieldName.toLowerCase().includes(p.text.toLowerCase().replace(/[[\]]/g, "")),
    )

    if (placeholder) {
      setEditingField(placeholder.id)
      const editMessage: Message = {
        id: `edit_${Date.now()}`,
        type: "bot",
        content: `What should I put for "${placeholder.text}" instead?`,
      }
      setMessages((prev) => [...prev, editMessage])
    } else {
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        type: "bot",
        content: "I couldn't find that field. Please try again with the exact field name from the summary above.",
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentInput.trim()) return

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: "user",
      content: currentInput,
    }
    setMessages((prev) => [...prev, userMessage])

    if (editingField) {
      // Handle field editing
      const placeholder = documentData.placeholders.find((p) => p.id === editingField)
      if (placeholder) {
        placeholder.value = currentInput
        setEditingField(null)
        setCurrentInput("")

        setTimeout(() => {
          const confirmMessage: Message = {
            id: `updated_${Date.now()}`,
            type: "bot",
            content: `Updated! I've changed "${placeholder.text}" to "${currentInput}".`,
          }
          setMessages((prev) => [...prev, confirmMessage])

          // Show summary again
          setTimeout(() => showSummary(), 1000)
        }, 500)
      }
      return
    }

    if (showFinalConfirmation) {
      // Handle final confirmation
      if (currentInput.toLowerCase().includes("yes")) {
        setCurrentInput("")
        setTimeout(() => {
          const completeMessage: Message = {
            id: `complete_${Date.now()}`,
            type: "bot",
            content:
              "Perfect! Your document is now complete and ready for review. Click 'Continue to Preview' to see the final document.",
          }
          setMessages((prev) => [...prev, completeMessage])
          setIsComplete(true)
        }, 500)
      } else {
        // Handle field changes
        const input = currentInput.toLowerCase()
        if (input.includes("change")) {
          const fieldName = input.replace("change", "").trim()
          handleFieldEdit(fieldName)
        } else {
          const errorMessage: Message = {
            id: `error_${Date.now()}`,
            type: "bot",
            content: 'Please type "yes" to proceed or "change [field name]" to modify a specific field.',
          }
          setMessages((prev) => [...prev, errorMessage])
        }
        setCurrentInput("")
      }
      return
    }

    // Regular input handling - just collect the value and move to next
    const currentPlaceholder = documentData.placeholders[currentPlaceholderIndex]
    currentPlaceholder.value = currentInput
    setCurrentInput("")

    const nextIndex = currentPlaceholderIndex + 1
    setCurrentPlaceholderIndex(nextIndex)

    setTimeout(() => {
      askNextPlaceholder(nextIndex)
    }, 500)
  }

  const filledCount = documentData.placeholders.filter((p) => p.value).length

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Chat Interface */}
      <div className="lg:col-span-2">
        <Card className="h-[600px] flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Document Assistant
              </CardTitle>
              <Button variant="outline" size="sm" onClick={onStartOver}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Start Over
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] p-3 rounded-lg word-wrap ${
                      message.type === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                    }`}
                    style={{
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                      hyphens: "auto",
                    }}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            {!isComplete && (
              <div className="flex-shrink-0">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    placeholder="Type your answer..."
                    className="flex-1"
                  />
                  <Button type="submit" disabled={!currentInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            )}

            {isComplete && (
              <div className="flex-shrink-0">
                <Button onClick={onComplete} className="w-full" size="lg">
                  Continue to Preview
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Completed</span>
                <span>
                  {filledCount}/{documentData.placeholders.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(filledCount / documentData.placeholders.length) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Placeholders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {documentData.placeholders.map((placeholder, index) => (
                <div
                  key={placeholder.id}
                  className={`p-2 rounded border text-sm ${
                    placeholder.value
                      ? "bg-green-50 border-green-200"
                      : index === currentPlaceholderIndex
                        ? "bg-blue-50 border-blue-200"
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs break-words">{placeholder.text}</span>
                    {placeholder.value && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                  </div>
                  {placeholder.value && (
                    <Badge variant="secondary" className="text-xs break-words max-w-full">
                      <span className="truncate">{placeholder.value}</span>
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
