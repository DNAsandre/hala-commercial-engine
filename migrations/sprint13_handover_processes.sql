-- --------------------------------------------------------------------------------
-- Handover Subsystem - Schema Migration
-- Table: handover_processes
-- --------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS handover_processes (
  id TEXT PRIMARY KEY,
  customer TEXT NOT NULL,
  workspace TEXT NOT NULL,
  crm_deal_id TEXT NOT NULL,
  contract_value NUMERIC NOT NULL DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  target_go_live TIMESTAMP WITH TIME ZONE,
  overall_progress INTEGER NOT NULL DEFAULT 0,
  msa_status TEXT NOT NULL DEFAULT 'pending',
  departments JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed some initial data to match the UI state so that the page isn't empty right away
INSERT INTO handover_processes (id, customer, workspace, crm_deal_id, contract_value, start_date, target_go_live, overall_progress, msa_status, departments)
VALUES
(
  'h1', 'Aramco Services', 'Aramco Dhahran VAS Expansion', 'ZH-4410', 12000000, '2026-02-08T00:00:00Z', '2026-04-01T00:00:00Z', 35, 'negotiating',
  '[
      {
        "name": "Sales / Commercial",
        "icon": "Users",
        "tasks": [
          { "task": "Client agrees on Hala SCS Proposal", "status": "completed", "assignee": "Ra''ed", "dueDate": "2026-02-08" },
          { "task": "Request CA, Communication Matrix & Legal docs", "status": "completed", "assignee": "Ra''ed", "dueDate": "2026-02-10" },
          { "task": "Draft MSA & SO/SLA with Ops agreement", "status": "in_progress", "assignee": "Ra''ed", "dueDate": "2026-02-18" },
          { "task": "Issue MSA & SO/SLA to Client, Cc. Sales", "status": "pending", "assignee": "Ra''ed", "dueDate": "2026-02-22" },
          { "task": "Close & Update CRM with reason", "status": "pending", "assignee": "Ra''ed", "dueDate": "2026-02-25" },
          { "task": "Brief Ops on new client", "status": "pending", "assignee": "Ra''ed", "dueDate": "2026-03-01" },
          { "task": "Send introduction email to client + ops", "status": "pending", "assignee": "Ra''ed", "dueDate": "2026-03-03" },
          { "task": "Advise Finance on agreed invoicing process", "status": "pending", "assignee": "Ra''ed", "dueDate": "2026-03-05" },
          { "task": "Request client training on vendor portal", "status": "pending", "assignee": "Ra''ed", "dueDate": "2026-03-10" }
        ]
      },
      {
        "name": "Legal Department",
        "icon": "Scale",
        "tasks": [
          { "task": "MSA negotiation", "status": "in_progress", "assignee": "Legal Team", "dueDate": "2026-02-20" },
          { "task": "Handover original documents", "status": "pending", "assignee": "Legal Team", "dueDate": "2026-03-01" },
          { "task": "Review contracts", "status": "pending", "assignee": "Legal Focal Point", "dueDate": "2026-03-05" }
        ]
      },
      {
        "name": "Finance Department",
        "icon": "DollarSign",
        "tasks": [
          { "task": "Review Insurance", "status": "pending", "assignee": "Finance", "dueDate": "2026-02-25" },
          { "task": "Review P&L", "status": "pending", "assignee": "Finance", "dueDate": "2026-02-28" },
          { "task": "Requirements / Cost analysis", "status": "pending", "assignee": "Finance", "dueDate": "2026-03-01" },
          { "task": "Process Bank Guarantees", "status": "pending", "assignee": "Finance", "dueDate": "2026-03-05" },
          { "task": "Share standard invoice & billing report", "status": "pending", "assignee": "Finance", "dueDate": "2026-03-10" },
          { "task": "Training on billing with client", "status": "pending", "assignee": "Finance", "dueDate": "2026-03-15" }
        ]
      },
      {
        "name": "Operations Department",
        "icon": "Settings",
        "tasks": [
          { "task": "Schedule kick-off meeting / starting date", "status": "pending", "assignee": "Ops Manager", "dueDate": "2026-03-01" },
          { "task": "Brief Ops on new client requirements", "status": "pending", "assignee": "Ops Manager", "dueDate": "2026-03-05" },
          { "task": "Upload MSA, SO/SLA & Legal docs in WMS/FS", "status": "pending", "assignee": "Ops Manager", "dueDate": "2026-03-10" },
          { "task": "Client portal setup and training", "status": "pending", "assignee": "IT/Ops", "dueDate": "2026-03-15" }
        ]
      }
    ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO handover_processes (id, customer, workspace, crm_deal_id, contract_value, start_date, target_go_live, overall_progress, msa_status, departments)
VALUES
(
  'h2', 'Nestlé KSA', 'Nestlé Jeddah Cold Chain', 'ZH-4450', 6200000, '2026-02-11T00:00:00Z', '2026-05-01T00:00:00Z', 15, 'pending',
  '[
      {
        "name": "Sales / Commercial",
        "icon": "Users",
        "tasks": [
          { "task": "Client agrees on Hala SCS Proposal", "status": "completed", "assignee": "Hano", "dueDate": "2026-02-11" },
          { "task": "Request CA, Communication Matrix & Legal docs", "status": "in_progress", "assignee": "Hano", "dueDate": "2026-02-18" },
          { "task": "Draft MSA & SO/SLA with Ops agreement", "status": "pending", "assignee": "Hano", "dueDate": "2026-02-25" },
          { "task": "Issue MSA & SO/SLA to Client", "status": "pending", "assignee": "Hano", "dueDate": "2026-03-01" }
        ]
      },
      {
        "name": "Legal Department",
        "icon": "Scale",
        "tasks": [
          { "task": "MSA negotiation", "status": "pending", "assignee": "Legal Team", "dueDate": "2026-03-05" },
          { "task": "Handover original documents", "status": "pending", "assignee": "Legal Team", "dueDate": "2026-03-15" }
        ]
      },
      {
        "name": "Finance Department",
        "icon": "DollarSign",
        "tasks": [
          { "task": "Review Insurance", "status": "pending", "assignee": "Finance", "dueDate": "2026-03-10" },
          { "task": "Review P&L", "status": "pending", "assignee": "Finance", "dueDate": "2026-03-15" },
          { "task": "Process Bank Guarantees", "status": "pending", "assignee": "Finance", "dueDate": "2026-03-20" }
        ]
      },
      {
        "name": "Operations Department",
        "icon": "Settings",
        "tasks": [
          { "task": "Schedule kick-off meeting", "status": "pending", "assignee": "Ops Manager", "dueDate": "2026-04-01" },
          { "task": "Cold chain facility preparation", "status": "pending", "assignee": "Ops Manager", "dueDate": "2026-04-15" }
        ]
      }
    ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
