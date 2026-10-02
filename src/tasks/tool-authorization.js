export function executeModelToolCall(name, args, executeTool) {
  if (name === "delete_file") {
    return {
      success: false,
      error: "Model-originated file deletion is not allowed. Only the explicit `/tasks approve <task-id>` flow can delete a pending task target.",
    };
  }
  return executeTool(name, args);
}

export function executeApprovedTaskDeletion(task, executeTool) {
  const approval = task?.pendingApproval;
  const path = String(approval?.path || "");
  if (task?.state !== "waiting_for_approval" || approval?.action !== "delete_file" || !path.trim()) {
    return { success: false, error: "No pending file deletion approval exists for this task." };
  }
  return executeTool("delete_file", { path });
}
