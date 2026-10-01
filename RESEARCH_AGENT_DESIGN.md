# AIRA Research Agent

## User flow

```text
User
  ↓
"Research X" or /agent research X
  ↓
Research Planner
  - scope the question
  - define assumptions
  - create 3–6 subquestions
  ↓
Source Search
  - use GPT-OSS server-side browser_search
  - search independent sources
  - prefer primary, academic, government, and reputable reporting sources
  ↓
Read / Extract
  - capture source URLs and relevant evidence
  - keep an evidence ledger in the report
  ↓
Cross-check
  - compare material claims across sources
  - identify disagreements and stale information
  - search again when a material gap remains
  ↓
Synthesize
  - cite the source URLs used
  - distinguish evidence from inference
  - list unresolved gaps
```

## AIRA implementation

The Research Agent is implemented as a bounded task runner in `src/app.js`:

- `/agent research` asks for a topic.
- `/agent research <topic>` starts directly.
- It creates a persisted Task Center task with `category: "agent"` and `agentType: "research"`.
- The task stores stage status, source URLs, local record timestamps, and research gaps in its `research` record.
- Completion is held back unless the report includes an Evidence store section, a cross-check section, and at least two explicit source URLs.
- The Research Agent requires a Groq key because this build exposes `browser_search` through the GPT-OSS route. Without it, no live research is claimed.
- A failed or interrupted run retains progress and is not reported as complete.

The agent uses the existing AIRA model loop instead of adding a new framework dependency. This keeps the browser app small while preserving the important boundaries: explicit stages, bounded execution, typed task state, evidence capture, and citation-aware synthesis.

## Patterns adopted from GitHub projects

| Project | Pattern used in AIRA |
|---|---|
| [LangGraph](https://github.com/langchain-ai/langgraph) | Explicit graph-like stages, accumulated state, bounded loops, and separate synthesis. |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | A scoped agent runner, explicit tool boundary, resumable task records, and bounded turns. |
| [CrewAI](https://github.com/crewAIInc/crewAI) | Planner → research → validation → report stages, typed intermediate data, and guardrail-style completion checks. |
| [LlamaIndex](https://github.com/run-llama/llama_index) | Event/stage transitions, per-run state, source-aware synthesis, and bounded retry/iteration concepts. |
| [AutoGen](https://github.com/microsoft/autogen) | Planner/progress ledger, independent search workers, evidence-carrying records, and a review loop. AutoGen was treated as a reference only because its repository is in maintenance mode. |

Additional official references reviewed:

- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)
- [OpenAI Agents SDK running agents](https://openai.github.io/openai-agents-python/running_agents/)
- [CrewAI planning](https://docs.crewai.com/en/concepts/planning)
- [CrewAI flows](https://docs.crewai.com/en/concepts/flows)
- [LlamaIndex workflows](https://docs.llamaindex.ai/en/stable/module_guides/workflow/)
- [AutoGen literature review example](https://microsoft.github.io/autogen/0.4.1/user-guide/agentchat-user-guide/examples/literature-review.html)

## Deliberate limitations

- Source citation verification is application logic, not a promise made by any of the referenced frameworks.
- The current browser app stores source URLs and the report as task evidence; its timestamps indicate when AIRA recorded the report, not an independently verified page-fetch time. It does not yet store full page snapshots or independently fetch every cited page.
- The Research Agent does not publish, email, purchase, or change external accounts.
- A report with insufficient evidence remains `partial`, even if the model writes `Outcome: COMPLETE`.
