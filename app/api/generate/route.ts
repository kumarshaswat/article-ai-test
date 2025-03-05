import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// This is the directory where your articles are stored
const ARTICLES_DIR = path.join(process.cwd(), "articles");

// Default model to use
const AI_MODEL = "deepseek-r1:1.5b"; // Changed from llama2 to deepseek-coder 7B

// Localhost IP
const LOCALHOST_IP = "https://workable-lemur-primary.ngrok-free.app";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    // Ensure articles directory exists
    try {
      await fs.access(ARTICLES_DIR);
    } catch {
      // Create the directory if it doesn't exist
      await fs.mkdir(ARTICLES_DIR, { recursive: true });

      // Create a sample article if none exist
      const sampleArticle = `# Welcome to the Article Generator

This is a sample article that was automatically created because no articles were found in the 'articles' directory.

## How to Add Articles

1. Create text files (.txt) or markdown files (.md) in the 'articles' directory
2. Each article should have a clear title and content
3. The AI will use these articles as reference to generate new content

## Example Article Structure

Title: The Future of Technology
Date: 2024-02-27

Artificial Intelligence and machine learning continue to reshape our world...

## Next Steps

Replace this sample article with your own content to get better results!`;

      await fs.writeFile(
        path.join(ARTICLES_DIR, "sample-article.md"),
        sampleArticle
      );
    }

    // Read all articles from the directory
    const articleFiles = await fs.readdir(ARTICLES_DIR);

    if (articleFiles.length === 0) {
      return NextResponse.json(
        { error: "No articles found in the articles directory" },
        { status: 400 }
      );
    }

    // Read and process each article
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

    if (articles.length === 0) {
      return NextResponse.json(
        { error: "No valid article files found (.txt or .md files required)" },
        { status: 400 }
      );
    }

    // Prepare articles content for the AI prompt
    const articlesContent = articles
      .map(
        (article) =>
          `Title: ${article.title}\n\nContent:\n${article.content}\n\n`
      )
      .join("---\n");

    try {
      // Check if Ollama is running
      const ollamaCheck = await fetch(`${LOCALHOST_IP}/api/version`)
        .then((res) => res.ok)
        .catch(() => false);

      if (!ollamaCheck) {
        return NextResponse.json(
          {
            error:
              'Ollama server is not running. Please start Ollama with "ollama serve"',
          },
          { status: 503 }
        );
      }

      // Check if the model is available
      try {
        const modelCheckResponse = await fetch(`${LOCALHOST_IP}/api/tags`);
        const modelData = await modelCheckResponse.json();
        const isModelAvailable = modelData.models?.some(
          (model: { name: string }) => model.name === AI_MODEL
        );

        if (!isModelAvailable) {
          return NextResponse.json(
            {
              error: `The required AI model '${AI_MODEL}' is not installed. Please run:

ollama pull deepseek-r1:1.5b

If you experience issues, you can try a different model like:
ollama pull llama2`,
            },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error("Error checking model availability:", error);
      }

      // Generate article using Ollama
      const ollamaResponse = await fetch(`${LOCALHOST_IP}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          prompt: `You are an expert content writer. Based on the following reference articles, write a new comprehensive article about "${prompt}".
           Use the writing style, tone, and structure from these articles, but create entirely original content.
           Incorporate relevant insights and patterns from the source articles while maintaining originality.
           Do not include any thoughts or explanations about the writing process.
           Do not include any content within <think> tags.
           
           Reference Articles:
           ${articlesContent}
           
           Write a well-structured, engaging article about "${prompt}":`,
          stream: false,
          stop: ["<think></think>"],
        }),
      });

      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text();
        throw new Error(`Ollama API error: ${errorText}`);
      }

      const ollamaData = await ollamaResponse.json();

      return new Response(ollamaData.response, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    } catch (error) {
      console.error("Error connecting to Ollama:", error);
      return NextResponse.json(
        {
          error: `Failed to connect to Ollama: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }
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
