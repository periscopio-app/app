import { test } from "node:test";
import assert from "node:assert";
import { fetchNotionBoardTasks, KNOWN_SYSTEM_TASKS } from "./notion.service";

test("retorna o inventário de tarefas do sistema com contagens corretas", async () => {
  const result = await fetchNotionBoardTasks();

  assert.ok(result.total > 0, "O total de tarefas deve ser maior que 0");
  assert.ok(result.completedCount >= 6, "Pelo menos 6 tarefas devem estar marcadas como prontas");
  assert.ok(Array.isArray(result.tasks), "tasks deve ser um Array");
  assert.strictEqual(
    result.total,
    result.completedCount + result.inProgressCount + result.todoCount,
    "A soma dos status deve ser igual ao total de tarefas"
  );
});

test("contém a tarefa da Hero e Google Auth como concluídas", async () => {
  const result = await fetchNotionBoardTasks();
  const heroTask = result.tasks.find((t) => t.id === "task-001");
  const googleAuthTask = result.tasks.find((t) => t.id === "task-002");

  assert.strictEqual(heroTask?.status, "pronta");
  assert.strictEqual(googleAuthTask?.status, "pronta");
});
