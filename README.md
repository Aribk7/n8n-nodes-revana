# n8n-nodes-revana

An [n8n](https://n8n.io/) community node for [Revana](https://revana.si): generate AI video, images and music with Seedance 2.5, Veo 3.1, Kling, Wan, Nano Banana Pro, GPT Image, MiniMax and 200+ other models, and chat with text models (Claude, Gemini, DeepSeek and more), all through one API key.

Revana routes each job to the cheapest provider that is working at that moment, fails over automatically, and only bills generations that succeed. Live prices: [api.revana.si/v1/models](https://api.revana.si/v1/models).

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Usage](#usage) · [Resources](#resources)

## Installation

In n8n, open **Settings → Community Nodes → Install** and enter `n8n-nodes-revana`. See the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Operations

| Operation | What it does |
|---|---|
| **Generate Media** | Creates a video, image or music generation. Optionally waits until it finishes and attaches the file as binary data (`data`, `data2`, ...). |
| **Get Generation** | Returns the status, output links and cost of a generation by ID. |
| **List Models** | Lists every model (or only video, image, audio or text) with its options and live price. No key needed for this call. |
| **Chat** | Sends a message to a text model through Revana's OpenAI-compatible chat completions endpoint. |

Generate Media options: resolution, aspect ratio, duration, audio, image URL (first frame / reference), max cost in USD, max wait, and an **Extra Input (JSON)** field for any other model-specific input.

The node is marked `usableAsTool`, so an AI Agent node can call it.

## Credentials

1. Create an account and API key at [revana.si/dashboard](https://revana.si/dashboard).
2. In n8n, add a **Revana API** credential and paste the key. The credential test calls `GET /v1/balance`.

## Usage

- **Try it for free:** pick the `minimax-h3-free` model; it costs $0.
- **Video** generations usually take 30 seconds to a few minutes. Leave **Wait for Result** on for simple flows, or turn it off and use **Get Generation** later (or a Wait node) for long jobs.
- Failed generations are not charged, so retrying a failed item is safe.
- Use **Max Cost (USD)** to cap what a single generation may cost.

## Compatibility

Built with `@n8n/node-cli` 0.54 and tested against the live Revana API. Requires n8n 1.x or later.

## Resources

- [Revana API documentation](https://revana.si/docs)
- [OpenAPI specification](https://revana.si/openapi.json)
- [Revana SDK for JavaScript (`revana` on npm)](https://www.npmjs.com/package/revana)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Version history

- **0.1.0** — Generate Media, Get Generation, List Models, Chat.
