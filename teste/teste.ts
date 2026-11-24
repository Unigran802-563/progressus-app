import { createRequire } from "node:module";
import { delimiter, join } from "node:path";

const requireLocal = createRequire(join(process.cwd(), "__test__.cjs"));

type BrowserApi = { chromium: { launch: (options: { headless: boolean }) => Promise<any> } };
type Locator = any;
type Page = any;

function loadPlaywright(): BrowserApi {
  try {
    return requireLocal("playwright") as BrowserApi;
  } catch {
    const bin = (process.env.PATH ?? "").split(delimiter).find((path) => path.includes("/_npx/") && path.endsWith("/node_modules/.bin"));
    if (!bin) throw new Error("Playwright não encontrado. Execute o script com Playwright e tsx via npx.");
    return createRequire(join(bin, "__test_loader__.cjs"))("playwright") as BrowserApi;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function shown(locator: Locator, message: string): Promise<void> {
  try {
    await locator.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    throw new Error(message);
  }
}

async function gone(locator: Locator, message: string): Promise<void> {
  try {
    await locator.waitFor({ state: "hidden", timeout: 20_000 });
  } catch {
    throw new Error(message);
  }
}

function localDateTime(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

function config() {
  const base = process.env.TEST_BASE_URL?.trim();
  const email = process.env.TEST_EMAIL?.trim();
  const password = process.env.TEST_PASSWORD;
  assert(base, "Defina TEST_BASE_URL.");
  assert(email, "Defina TEST_EMAIL.");
  assert(password, "Defina TEST_PASSWORD.");
  const url = new URL(base);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (!local && process.env.ALLOW_PRODUCTION_TESTS !== "true") throw new Error("Defina ALLOW_PRODUCTION_TESTS=true para autorizar a URL remota.");
  if (!local && url.protocol !== "https:") throw new Error("A URL remota precisa usar HTTPS.");
  return { base: url.origin, email, password };
}

async function main() {
  const { base, email, password } = config();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: process.env.HEADFUL !== "true" });
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);

  const runId = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const project = `TESTE_QA_${runId}`;
  const projectEdited = `${project}_EDITADO`;
  const taskCrud = `TESTE_Tarefa_CRUD_${runId}`;
  const taskCalendar = `TESTE_Tarefa_Calendario_${runId}`;
  const messageText = `TESTE_Mensagem_${runId}`;
  const projectDescription = `TESTE_Descrição_${runId}`;
  const taskDescription = `TESTE_Descrição_Tarefa_${runId}`;
  let projectId: string | null = null;
  let trashed = false;
  let completed = 0;
  let error: unknown;
  let cleanupError: unknown;

  const run = async (action: () => Promise<void>) => {
    await action();
    completed += 1;
  };

  const openTasks = async () => {
    assert(projectId, "ID do projeto indisponível.");
    await page.goto(`${base}/projects/${projectId}/tasks`);
    await shown(page.getByRole("heading", { name: "Tarefas do projeto", exact: true }), "Tarefas não carregaram.");
    await shown(page.getByRole("button", { name: "Kanban", exact: true }), "Kanban não carregou.");
    await shown(page.getByRole("button", { name: "Nova tarefa", exact: true }).last(), "Tarefas não carregaram.");
  };

  const createTask = async (name: string, due?: string) => {
    await page.getByRole("button", { name: "Nova tarefa", exact: true }).last().click();
    await shown(page.locator("#project-task-name"), "Formulário de tarefa não abriu.");
    await page.locator("#project-task-name").fill(name);
    const responsible = page.locator("#project-task-responsible");
    const id = await responsible.evaluate((element: HTMLSelectElement) => {
      const options = Array.from(element.options).filter((option) => option.value);
      return options.find((option) => option.textContent?.includes("(você)"))?.value ?? options[0]?.value ?? "";
    });
    assert(id, "Não há responsável selecionável.");
    await responsible.selectOption(id);
    if (due) {
      const dueInput = page.locator("#project-task-due-date");
      await dueInput.fill(due);
      assert(await dueInput.inputValue() === due, "O prazo não permaneceu preenchido no formulário.");
    }
    await page.getByRole("button", { name: "Criar tarefa", exact: true }).click();
    await shown(page.getByRole("button", { name, exact: true }), `Tarefa não apareceu: ${name}`);
  };

  const removeTask = async (name: string) => {
    if (!projectId) return;
    try {
      await openTasks();
      const title = page.getByRole("button", { name, exact: true }).first();
      if (!(await title.isVisible().catch(() => false))) return;
      await page.getByRole("button", { name: `Editar tarefa ${name}`, exact: true }).first().click();
      const dialog = page.getByRole("dialog").filter({ hasText: "Editar tarefa" }).last();
      await shown(dialog, "Edição da tarefa não abriu.");
      await dialog.getByRole("button", { name: "Excluir tarefa", exact: true }).click();
      await page.getByRole("button", { name: "Excluir tarefa", exact: true }).last().click();
      await gone(page.getByRole("button", { name, exact: true }).first(), `Tarefa permaneceu: ${name}`);
    } catch (e) {
      console.error(`[limpeza] ${e instanceof Error ? e.message : String(e)}`);
      cleanupError ??= e;
    }
  };

  const removeMessage = async () => {
    if (!projectId) return;
    try {
      await page.goto(`${base}/chat/${projectId}`);
      const text = page.getByText(messageText, { exact: true });
      if (!(await text.isVisible().catch(() => false))) return;
      await page.getByRole("button", { name: "Ações da mensagem", exact: true }).last().click();
      await page.getByRole("button", { name: "Apagar para todos", exact: true }).click();
      await page.getByRole("button", { name: "Apagar para todos", exact: true }).last().click();
      await gone(text, "Mensagem permaneceu no chat.");
    } catch (e) {
      console.error(`[limpeza] ${e instanceof Error ? e.message : String(e)}`);
      cleanupError ??= e;
    }
  };

  const removeProject = async () => {
    if (!projectId) return;
    try {
      await page.goto(`${base}/projects/${projectId}`);
      if (!trashed) {
        await page.getByRole("button", { name: "Excluir", exact: true }).click();
        await page.getByRole("button", { name: "Mover para a lixeira", exact: true }).click();
        await shown(page.getByText("Projeto excluído", { exact: true }), "Projeto não foi movido para a lixeira.");
        trashed = true;
      }
      await page.goto(`${base}/projects`);
      await page.getByRole("button", { name: /^Lixeira(?:\s|\()/ }).click();
      const link = page.locator(`a[href="/projects/${projectId}"]`).filter({ hasText: project }).first();
      await shown(link, "Projeto não apareceu na lixeira.");
      const card = page.locator("div.card-elevated").filter({ has: link }).first();
      await card.getByRole("button", { name: "Excluir definitivamente", exact: true }).click();
      const dialog = page.getByRole("dialog").filter({ hasText: project }).last();
      await shown(dialog, "Confirmação de exclusão não apareceu.");
      assert((await dialog.innerText()).includes(project), "Projeto confirmado não corresponde.");
      await dialog.getByRole("button", { name: "Excluir definitivamente", exact: true }).click();
      await gone(link, "Projeto permaneceu na lixeira.");
    } catch (e) {
      console.error(`[limpeza] ${e instanceof Error ? e.message : String(e)}`);
      cleanupError ??= e;
    }
  };

  try {
    await run(async () => {
      await page.goto(`${base}/auth/login`);
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Entrar no Progressus", exact: true }).click();
      await page.waitForURL((url: URL) => !url.pathname.startsWith("/auth/login"), { timeout: 30_000 });
    });

    await run(async () => {
      await page.goto(`${base}/projects`);
      await page.getByRole("button", { name: "Novo projeto", exact: true }).last().click();
      await page.locator("#project-name").fill(project);
      await page.locator("#project-description").fill(`TESTE_Projeto_${runId}`);
      await page.getByRole("button", { name: "Criar projeto", exact: true }).click();
      const link = page.locator('a[href^="/projects/"]').filter({ hasText: project }).first();
      await shown(link, "Projeto não apareceu.");
      const href = await link.getAttribute("href");
      projectId = href?.match(/^\/projects\/([^/?#]+)$/)?.[1] ?? null;
      assert(projectId, "ID do projeto não foi identificado.");
      await page.goto(`${base}/projects/${projectId}`);
      await page.getByRole("button", { name: "Editar", exact: true }).click();
      await page.locator("#edit-project-name").fill(projectEdited);
      await page.locator("#edit-project-description").fill(projectDescription);
      await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
      await shown(page.getByRole("heading", { name: projectEdited }), "Projeto editado não apareceu.");
      await shown(page.getByText(projectDescription, { exact: true }), "Descrição não foi atualizada.");
    });

    await run(async () => {
      await openTasks();
      await createTask(taskCrud);
      const status = page.getByLabel(`Alterar status de ${taskCrud}`, { exact: true });
      const next = await status.evaluate((element: HTMLSelectElement) => Array.from(element.options).find((option) => option.value && option.value !== element.value)?.value ?? "");
      assert(next, "Não há outro status disponível.");
      await status.selectOption(next);
      await page.getByRole("button", { name: "Lista", exact: true }).click();
      await shown(page.getByRole("button", { name: taskCrud, exact: true }), "Tarefa não apareceu em Lista.");
      await page.getByRole("button", { name: "Kanban", exact: true }).click();
      await page.getByRole("button", { name: `Editar tarefa ${taskCrud}`, exact: true }).click();
      const dialog = page.getByRole("dialog").filter({ hasText: "Editar tarefa" }).last();
      await dialog.locator("textarea").first().fill(taskDescription);
      await dialog.locator('select[id$="-priority"]').selectOption({ label: "Alta" });
      await dialog.getByRole("button", { name: "Salvar alterações", exact: true }).click();
      await shown(page.getByText(taskDescription, { exact: true }), "Tarefa não foi atualizada.");
      await removeTask(taskCrud);
      await gone(page.getByRole("button", { name: taskCrud, exact: true }).first(), "Tarefa não foi removida.");
    });

    await run(async () => {
      await openTasks();
      const due = new Date();
      due.setDate(due.getDate() + 1);
      due.setHours(12, 0, 0, 0);
      const dueValue = localDateTime(due);
      await createTask(taskCalendar, dueValue);
      await page.getByRole("button", { name: `Editar tarefa ${taskCalendar}`, exact: true }).click();
      const editDialog = page.getByRole("dialog").filter({ hasText: "Editar tarefa" }).last();
      const savedDue = editDialog.locator('input[id$="-due-date"]');
      await shown(savedDue, "Prazo salvo não apareceu na edição da tarefa.");
      assert(await savedDue.inputValue() === dueValue, "O prazo da tarefa não foi persistido corretamente.");
      await page.goto(`${base}/calendar`);
      await page.getByRole("button", { name: "Mês", exact: true }).click();
      const controls = page.locator("section.surface-panel").filter({ has: page.getByRole("button", { name: "Hoje", exact: true }) }).first();
      const nextPeriod = controls.getByRole("button").nth(2);
      const task = page.getByText(taskCalendar, { exact: true });
      if (!(await task.isVisible().catch(() => false))) await nextPeriod.click();
      await shown(task, "Tarefa não apareceu no calendário mensal.");
      await page.getByRole("button", { name: "Hoje", exact: true }).click();
      await page.getByRole("button", { name: "Semana", exact: true }).click();
      if (!(await task.isVisible().catch(() => false))) await nextPeriod.click();
      await shown(task, "Tarefa não apareceu no calendário semanal.");
      await removeTask(taskCalendar);
      await gone(page.getByRole("button", { name: taskCalendar, exact: true }).first(), "Tarefa do calendário não foi removida.");
    });

    await run(async () => {
      await page.goto(`${base}/chat/${projectId}`);
      const input = page.getByPlaceholder("Digite uma mensagem...", { exact: true });
      await input.fill(messageText);
      await page.getByRole("button", { name: "Enviar mensagens", exact: true }).click();
      const text = page.getByText(messageText, { exact: true });
      await shown(text, "Mensagem não apareceu.");
      await page.getByRole("button", { name: "Ações da mensagem", exact: true }).last().click();
      await page.getByRole("button", { name: "Apagar para todos", exact: true }).click();
      await page.getByRole("button", { name: "Apagar para todos", exact: true }).last().click();
      await gone(text, "Mensagem não foi removida.");
    });
  } catch (e) {
    error = e;
  } finally {
    if (projectId) {
      await removeMessage();
      await removeTask(taskCrud);
      await removeTask(taskCalendar);
      await removeProject();
    }
    await browser.close();
  }

  console.log(`${completed} etapas concluídas.`);
  if (error) {
    console.error(error);
    process.exitCode = 1;
  }
  if (cleanupError) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
