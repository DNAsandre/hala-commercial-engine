# Agent Embedding Patterns Reference

## Source Documents Used
Documents 39-45, 53-56, Document 38

## Key Rules
- 3 embedding categories: UI-Visible Agents, UI-Linked Background Agents, Embedded Workflow Agents
- 4-Layer Model: UI Component → Interaction → Agent Logic → Backend Integration
- 6 approved patterns: Chat Window, Sidebar Assistant, Inline Helper, Dashboard Copilot, Action Buttons, Background Worker
- Agent registry table: id, name, role, permissions, memory_scope, tool_access, behavior_rules, version, created_at
- 7 standard agent archetypes: Architect, Engineer, Debugger, UX Pilot, Data Guardian, Workflow Orchestrator, Personal Guide
- Permission tiers: Tier 1 (Read Only), Tier 2 (Limited Write), Tier 3 (Full Engineering)

## Forbidden Actions
- Agents sharing memory without explicit permission
- Agents acting outside their domain
- Cross-memory leakage between agents
- Agents modifying other agents
- Creating agents without registry entry
