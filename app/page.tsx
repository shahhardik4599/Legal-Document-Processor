"use client"

import { useState } from "react"
import { Upload, FileText, MessageCircle, Download } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import DocumentUpload from "@/components/document-upload"
import ChatInterface from "@/components/chat-interface"
import DocumentPreview from "@/components/document-preview"

export type Placeholder = {
  id: string
  text: string
  value?: string
  description?: string
}

export type DocumentData = {
  originalContent: string
  placeholders: Placeholder[]
  fileName: string
  originalFile?: File // Store the original file
}

export default function Home() {
  const [step, setStep] = useState<"upload" | "chat" | "preview">("upload")
  const [documentData, setDocumentData] = useState<DocumentData | null>(null)

  const handleDocumentProcessed = (data: DocumentData) => {
    setDocumentData(data)
    setStep("chat")
  }

  const handlePlaceholdersFilled = () => {
    setStep("preview")
  }

  const handleStartOver = () => {
    setStep("upload")
    setDocumentData(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Legal Document Processor</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload your legal document draft, fill in the placeholders through our conversational interface, and
            download your completed document.
          </p>
        </div>
        {/* Features Section */}
        {step === "upload" && (
          <div className="mt-16 mb-8 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <FileText className="w-8 h-8 text-blue-600 mb-2" />
                <CardTitle>Smart Detection</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Automatically identifies placeholders and template text in your legal documents
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <MessageCircle className="w-8 h-8 text-green-600 mb-2" />
                <CardTitle>Conversational Interface</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Fill in document details through an intuitive chat-like experience</CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Download className="w-8 h-8 text-purple-600 mb-2" />
                <CardTitle>Original Document</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Download your original document with all placeholders filled in</CardDescription>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div
              className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                step === "upload"
                  ? "bg-blue-600 text-white"
                  : step === "chat" || step === "preview"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </div>
            <div className={`w-8 h-0.5 ${step === "chat" || step === "preview" ? "bg-green-600" : "bg-gray-300"}`} />
            <div
              className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                step === "chat"
                  ? "bg-blue-600 text-white"
                  : step === "preview"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Fill Details</span>
            </div>
            <div className={`w-8 h-0.5 ${step === "preview" ? "bg-green-600" : "bg-gray-300"}`} />
            <div
              className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                step === "preview" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-[70rem] mx-auto">
          {step === "upload" && <DocumentUpload onDocumentProcessed={handleDocumentProcessed} />}

          {step === "chat" && documentData && (
            <ChatInterface
              documentData={documentData}
              onComplete={handlePlaceholdersFilled}
              onStartOver={handleStartOver}
            />
          )}

          {step === "preview" && documentData && (
            <DocumentPreview documentData={documentData} onStartOver={handleStartOver} />
          )}
        </div>

        
      </div>
    </div>
  )
}
