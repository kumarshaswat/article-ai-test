"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FileText, AlertTriangle, ChevronRight } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [rawArticle, setRawArticle] = useState("");
  const [processedArticle, setProcessedArticle] = useState("");
  const [thoughtContent, setThoughtContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedThought, setExpandedThought] = useState(false);

  useEffect(() => {
    // Process the raw article when it changes
    if (rawArticle) {
      const thoughtMatch = rawArticle.match(/<think>(.*?)<\/think>/s);
      const markdownContent = rawArticle
        .replace(/<think>.*?<\/think>/s, "")
        .trim();

      if (thoughtMatch) {
        setThoughtContent(thoughtMatch[1].trim());
      }
      setProcessedArticle(markdownContent);
    }
  }, [rawArticle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    setIsLoading(true);
    setRawArticle("");
    setProcessedArticle("");
    setThoughtContent("");
    setError(null);
    setExpandedThought(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate article");
      }

      // Create a reader for streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      // Stream the response token by token
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and update the article text
        const chunk = decoder.decode(value);
        setRawArticle((prev) => prev + chunk);
      }
    } catch (error) {
      console.error("Error generating article:", error);
      setError(
        error instanceof Error ? error.message : "Failed to generate article"
      );
      setRawArticle("");
      setProcessedArticle("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto py-10 px-4">
      <div className="flex items-center justify-center gap-2 mb-8">
        <FileText className="h-8 w-8" />
        <h1 className="text-3xl font-bold text-center">AI Article Generator</h1>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Generate New Article</CardTitle>
            <CardDescription>
              Enter a topic to generate an article based on your reference
              articles
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent>
              <Input
                placeholder="Enter your article topic or theme"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="mb-4"
              />
              <p className="text-sm text-muted-foreground">
                Place your reference articles (.txt or .md files) in the
                &apos;articles&apos; directory
              </p>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoading || !prompt.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Article"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        {processedArticle && (
          <div className="space-y-4">
            {thoughtContent && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <button
                      onClick={() => setExpandedThought(!expandedThought)}
                      className="flex items-center hover:bg-accent hover:text-accent-foreground p-1 rounded"
                    >
                      <ChevronRight
                        className={`mr-2 transition-transform ${
                          expandedThought ? "rotate-90" : ""
                        }`}
                      />
                      AI Thought Process
                    </button>
                  </CardTitle>
                </CardHeader>
                {expandedThought && (
                  <CardContent className="bg-muted/50 p-4 rounded-b-lg">
                    <pre className="whitespace-pre-wrap text-sm">
                      {thoughtContent}
                    </pre>
                  </CardContent>
                )}
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Generated Article</CardTitle>
              </CardHeader>
              <CardContent className="prose max-w-none p-12">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {processedArticle}
                </Markdown>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center items-center mt-4">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
      </div>
    </main>
  );
}
