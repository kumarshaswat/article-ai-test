import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

// This is the directory where your articles are stored
const ARTICLES_DIR = path.join(process.cwd(), "articles");

// Default model to use
const AI_MODEL = "deepseek-r1:7b";

// Localhost IP
const LOCALHOST_IP = "https://workable-lemur-primary.ngrok-free.app";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    // Create a streaming response
    const encoder = new TextEncoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Check if Ollama is running
            const ollamaCheck = await fetch(`${LOCALHOST_IP}/api/version`)
              .then((res) => res.ok)
              .catch(() => false);

            if (!ollamaCheck) {
              controller.error(new Error("Ollama server is not running"));
              return;
            }

            // Prepare articles content
            const articleFiles = await fs.readdir(ARTICLES_DIR);
            const articles = await Promise.all(
              articleFiles
                .filter((file) => file.endsWith(".txt") || file.endsWith(".md"))
                .map(async (file) => {
                  const filePath = path.join(ARTICLES_DIR, file);
                  const content = await fs.readFile(filePath, "utf-8");
                  return {
                    title: file.replace(/\.(txt|md)$/, ""),
                    content,
                  };
                })
            );

            const articlesContent = articles
              .map(
                (article) =>
                  `Title: ${article.title}\n\nContent:\n${article.content}\n\n`
              )
              .join("---\n");

            // Create the fetch request to Ollama for streaming
            const response = await fetch(`${LOCALHOST_IP}/api/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: AI_MODEL,
                prompt: `You are an expert content writer. Based on the following reference articles, write a new comprehensive article about "${prompt}".
                 Use the writing style, tone, and structure from these articles, but create entirely original content.
                 Incorporate relevant insights and patterns from the source articles while maintaining originality.
                 Only write in markdown format.
                 Also please only respond in English.
                 
                 Reference Articles:
                 ${articlesContent}
                 
                 Write a well-structured, engaging article about "${prompt}":`,
                stream: true,
                stop: ["<think></think>"],
              }),
            });

            // Handle the streaming response
            if (!response.body) {
              controller.error(new Error("No response body"));
              return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                controller.close();
                break;
              }

              const chunk = decoder.decode(value);
              try {
                const parsedChunk = JSON.parse(chunk);
                if (parsedChunk.response) {
                  controller.enqueue(encoder.encode(parsedChunk.response));
                }
              } catch (parseError) {
                // If parsing fails, it might be a partial JSON or non-JSON response
                console.warn("Error parsing chunk:", parseError);
              }
            }
          } catch (error) {
            console.error("Streaming error:", error);
            controller.error(error);
          }
        },
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
        },
      }
    );
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      {
        error: `Failed to generate article: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
