"use client";

import type React from "react";
import { useState } from "react";
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
import { Loader2, FileText, AlertTriangle } from "lucide-react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [generatedArticle, setGeneratedArticle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    setIsLoading(true);
    setGeneratedArticle("");
    setError(null);

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

      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("text/plain")) {
        const text = await response.text();
        setGeneratedArticle(text);
      } else {
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setGeneratedArticle(data.article || "No content generated");
      }
    } catch (error) {
      console.error("Error generating article:", error);
      setError(
        error instanceof Error ? error.message : "Failed to generate article"
      );
      setGeneratedArticle("");
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

      <div className="grid gap-8 md:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Generated Article</CardTitle>
            <CardDescription>
              AI-generated article based on your reference materials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={generatedArticle}
              readOnly
              className="min-h-[400px] resize-none font-serif"
              placeholder="Your AI-generated article will appear here..."
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
