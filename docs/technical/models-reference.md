# AI Models Reference - Current Models (January 2025)

**Last Updated**: January 2025
**Official Sources**:

- OpenAI GPT-5: <https://openai.com/index/introducing-gpt-5/>
- Claude Sonnet 4.5: <https://www.anthropic.com/news/claude-sonnet-4-5>

---

## ✅ REAL, CURRENT MODELS

### OpenAI Models

#### GPT-5 (Latest - Released August 7, 2025)

- **Model ID**: `gpt-5`
- **Released**: August 7, 2025
- **Context Window**: 128,000 tokens
- **Key Features**:
  - First unified model combining reasoning + fast responses
  - State-of-the-art performance: 94.6% on AIME 2025 (math), 74.9% on SWE-bench Verified (coding)
  - Real-time intelligent routing between smart model and reasoning model
  - Multimodal (vision, audio)
- **Best For**: Creative content, proposals, general tasks, coding
- **Pricing**: $2.50/1M input | $10.00/1M output

#### GPT-5 Thinking (Deep Reasoning Variant)

- **Model ID**: `gpt-5-thinking`
- **Released**: August 7, 2025
- **Best For**: Complex problems requiring extended reasoning
- **Pricing**: $5.00/1M input | $20.00/1M output

---

### Anthropic Models

#### Claude Sonnet 4.5 (Latest - Released September 29, 2025)

- **Model ID**: `claude-sonnet-4-5-20250929`
- **Released**: September 29, 2025
- **Context Window**: 200,000 tokens
- **Key Features**:
  - **Best coding model in the world** (per Anthropic)
  - Maintains focus for **30+ hours** on complex tasks
  - Leads SWE-bench Verified and OSWorld benchmarks
  - Advanced computer use capabilities
  - Most aligned frontier model (reduced sycophancy, deception, power-seeking)
- **Best For**: Coding, complex multi-agent systems, long-running tasks, technical analysis
- **Pricing**: $3.00/1M input | $15.00/1M output

#### Claude Sonnet 4.5 Thinking (Extended Reasoning)

- **Model ID**: `claude-sonnet-4-5-20250929-thinking`
- **Best For**: Extended reasoning, complex problem solving
- **Pricing**: $6.00/1M input | $30.00/1M output

#### Claude Opus 4.1 (Maximum Capability)

- **Model ID**: `claude-opus-4-1-20250805`
- **Released**: August 5, 2025
- **Context Window**: 200,000 tokens
- **Best For**: Maximum capability reasoning, critical decisions
- **Pricing**: $15.00/1M input | $75.00/1M output

#### Claude Sonnet 4 (Previous Generation)

- **Model ID**: `claude-sonnet-4-20250514`
- **Released**: May 14, 2025
- **Context Window**: 200,000 tokens
- **Pricing**: $3.00/1M input | $15.00/1M output

#### Claude Opus 4 (Previous Generation)

- **Model ID**: `claude-opus-4-20250514`
- **Released**: May 14, 2025
- **Context Window**: 200,000 tokens
- **Pricing**: $15.00/1M input | $75.00/1M output

---

## 📋 Model Selection Guide

### By Task Type

| Task Type                    | Recommended Model                 | Reason                              |
| ---------------------------- | --------------------------------- | ----------------------------------- |
| **Proposal Generation**      | GPT-5                             | Creative writing, narrative quality |
| **Code Generation**          | Claude Sonnet 4.5                 | Best coding model, 30+ hour focus   |
| **Multi-Agent Coordination** | Claude Sonnet 4.5                 | Superior long-context handling      |
| **Document Analysis**        | Claude Sonnet 4.5                 | Analysis, compliance, reasoning     |
| **Complex Reasoning**        | GPT-5 Thinking or Claude Opus 4.1 | Deep reasoning capabilities         |
| **General Tasks**            | GPT-5                             | Fast, unified, multimodal           |

### By Agent Type (Our System)

| Agent                | Model             | Reason                       |
| -------------------- | ----------------- | ---------------------------- |
| Primary Orchestrator | Claude Sonnet 4.5 | 30+ hour focus, coordination |
| RFP Discovery        | GPT-5             | General capability, fast     |
| RFP Analysis         | GPT-5             | Analysis + creative writing  |
| RFP Submission       | GPT-5             | Form handling, general tasks |
| Portal Scanner       | Claude Sonnet 4.5 | Best for code/technical      |
| Compliance Checker   | Claude Sonnet 4.5 | Detailed analysis            |
| Content Generator    | GPT-5             | Creative writing             |
| Document Processor   | GPT-5             | Fast processing              |

---

## 🔧 Implementation in Our Codebase

### Main Configuration

- **File**: `src/mastra/models/index.ts`
- **Exports**: `gpt5`, `gpt5Thinking`, `claudeSonnet45`, `claudeSonnet45Thinking`, `claudeOpus41`

### Agent Configurations

All agents updated to use correct models:

- ✅ `src/mastra/agents/rfp-discovery-agent.ts` → `gpt-5`
- ✅ `src/mastra/agents/rfp-analysis-agent.ts` → `gpt-5`
- ✅ `src/mastra/agents/rfp-submission-agent.ts` → `gpt-5`
- ✅ `src/mastra/workflows/document-processing-workflow.ts` → `gpt-5`
- ✅ `src/mastra/workflows/proposal-generation-workflow.ts` → `gpt-5`

### Framework Versions

- **@mastra/core**: 0.20.1 ✅
- **@mastra/memory**: 0.15.6 ✅
- **ai SDK**: 5.0.60 ✅
- **Node.js**: 22.x ✅

---

## 📚 Official Documentation

### OpenAI

- Models: <https://platform.openai.com/docs/models>
- GPT-5 Announcement: <https://openai.com/index/introducing-gpt-5/>
- Pricing: <https://openai.com/pricing>

### Anthropic

- Models: <https://docs.claude.com/en/docs/about-claude/models>
- Claude Sonnet 4.5 Announcement: <https://www.anthropic.com/news/claude-sonnet-4-5>
- Pricing: <https://docs.anthropic.com/en/docs/about-claude/models#model-pricing>

---

## ⚠️ Important Notes

1. **Model IDs Must Be Exact**:
   - Use `claude-sonnet-4-5-20250929` NOT `claude-sonnet-4-5`
   - Use `gpt-5` for the base model
   - Always verify model IDs in official documentation

2. **Context Windows**:
   - GPT-5: 128K tokens
   - All Claude 4.x models: 200K tokens

3. **When to Use Reasoning Variants**:
   - `gpt-5-thinking`: Complex problems that benefit from extended thinking
   - `claude-sonnet-4-5-20250929-thinking`: Long-context reasoning tasks

4. **Cost Considerations**:
   - GPT-5: $2.50-$10.00 per 1M tokens (most cost-effective)
   - Claude Sonnet 4.5: $3.00-$15.00 per 1M tokens
   - Claude Opus 4.1: $15.00-$75.00 per 1M tokens (premium)

---

## 🔄 Migration Notes

If you see references to older models:

- ❌ GPT-4o → ✅ GPT-5 (GPT-4o is older)
- ❌ Claude 3.5 Sonnet → ✅ Claude Sonnet 4.5 (Claude 3.5 is older)
- ❌ Claude 3 Opus → ✅ Claude Opus 4.1 (Claude 3 is older)

**Last Migration**: January 2025 - All models updated to GPT-5 and Claude 4.x series.
