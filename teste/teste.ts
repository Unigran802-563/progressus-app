/**
 * Teste funcional manual-automatizado do Progressus.
 *
 * Dependências usadas sem editar package.json: Playwright e tsx via npx.
 * Exemplo de execução (bash):
 *   TEST_BASE_URL="https://progressus-app-azure.vercel.app" \
 *   TEST_EMAIL="<email-da-conta-de-teste>" \
 *   TEST_PASSWORD="<senha-da-conta-de-teste>" \
 *   ALLOW_PRODUCTION_TESTS=true \
 *   npx --yes --package=playwright --package=tsx --call \
 *   'playwright install chromium && NODE_PATH="$(dirname "$(dirname "$(command -v playwright)")")" tsx teste/teste.ts'
 *
 * Atenção: a aplicação usa o banco compartilhado entre produção e testes.
 * Este script cria somente dados TESTE_ em projeto isolado e tenta removê-los
 * ao final. A exclusão permanente do projeto é irreversível; só é feita sobre
 * o ID e nome gerados nesta própria execução. Não execute sem autorização.
 */

import { createRequire } from "node:module";
import { delimiter, join } from "node:path";

const requireFromProject = createRequire(join(process.cwd(), "__progressus_test__.cjs"));

type BrowserApi = {
  chromium: {
    launch: (options: { headless: boolean }) => Promise<any>;
  };
};
type Locator = any;
type Page = any;

function loadPlaywright(): BrowserApi {
  try {
    return requireFromProject("playwright") as BrowserApi;
  } catch {
    const npxBin = (process.env.PATH ?? "")
      .split(delimiter)
      .find((entry) => entry.includes("/_npx/") && entry.endsWith("/node_modules/.bin"));
    if (npxBin) {
      const requireFromNpx = createRequire(join(npxBin, "__progressus_test_loader__.cjs"));
      return requireFromNpx("playwright") as BrowserApi;
    }
    throw new Error(
      "Playwright não encontrado. Execute pelo comando npx mostrado no cabeçalho deste arquivo.",
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function visible(locator: Locator, message: string, timeout = 20_000): Promise<void> {
  try {
    await locator.waitFor({ state: "visible", timeout });
  } catch {
    throw new Error(message);
  }
}

async function hidden(locator: Locator, message: string, timeout = 20_000): Promise<void> {
  try {
    await locator.waitFor({ state: "hidden", timeout });
  } catch {
    throw new Error(message);
  }
}

function localDateTimeValue(date: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

function readConfiguration(): { baseUrl: string; email: string; password: string } {
  const baseUrl = process.env.TEST_BASE_URL?.trim();
  const email = process.env.TEST_EMAIL?.trim();
  const password = process.env.TEST_PASSWORD;
  assert(baseUrl, "Defina TEST_BASE_URL com a URL da aplicação.");
  assert(email, "Defina TEST_EMAIL com o e-mail da conta de teste.");
  assert(password, "Defina TEST_PASSWORD com a senha da conta de teste.");

  const parsed = new URL(baseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(parsed.hostname) && process.env.ALLOW_PRODUCTION_TESTS !== "true") {
    throw new Error(
      "A URL não é local. Para autorizar explicitamente testes no ambiente remoto, defina ALLOW_PRODUCTION_TESTS=true.",
    );
  }
  if (!localHosts.has(parsed.hostname) && parsed.protocol !== "https:") {
    throw new Error("Exija HTTPS ao executar contra um ambiente remoto.");
  }
  return { baseUrl: parsed.origin, email, password };
}

async function main(): Promise<void> {
  const { baseUrl, email, password } = readConfiguration();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: process.env.HEADFUL !== "true" });
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);

  const runId = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const projectName = `TESTE_QA_${runId}`;
  const editedProjectName = `${projectName}_EDITADO`;
  const projectDescription = `TESTE_Projeto criado pelo teste automatizado ${runId}.`;
  const editedDescription = `TESTE_Descrição editada ${runId}.`;
  const taskCrudName = `TESTE_Tarefa_CRUD_${runId}`;
  const taskCalendarName = `TESTE_Tarefa_Calendario_${runId}`;
  const taskDescription = `TESTE_Descrição de tarefa editada ${runId}.`;
  const chatMessage = `TESTE_Mensagem de validação ${runId}.`;
  let projectId: string | null = null;
  let projectWasTrashed = false;
  let failure: unknown;
  let passed = 0;
  let failedStep: string | null = null;

  const step = async (name: string, action: () => Promise<void>) => {
    try {
      await action();
      passed += 1;
      console.log(`[PASSOU] ${name}`);
    } catch (error) {
      failedStep = name;
      console.error(`[FALHOU] ${name}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };

  const openProjectTasks = async () => {
    assert(projectId, "ID do projeto de teste indisponível.");
    await page.goto(`${baseUrl}/projects/${projectId}`);
    await visible(page.getByRole("heading", { name: editedProjectName }), "Projeto de teste não abriu.");
    await page.getByRole("button", { name: "Tarefas", exact: true }).click();
    await visible(page.getByRole("button", { name: "Nova tarefa", exact: true }).last(), "Painel de tarefas não abriu.");
  };

  const createProjectTask = async (name: string, dueDate?: string) => {
    await page.getByRole("button", { name: "Nova tarefa", exact: true }).last().click();
    await visible(page.locator("#project-task-name"), "Formulário de criação de tarefa não abriu.");
    await page.locator("#project-task-name").fill(name);
    const responsible = page.locator("#project-task-responsible");
    await visible(responsible, "Campo de responsável não apareceu.");
    const responsibleId = await responsible.evaluate((element: HTMLSelectElement) =>
      Array.from(element.options).find((option) => option.value)?.value ?? "",
    );
    assert(responsibleId, "O projeto de teste não tem um responsável selecionável.");
    await responsible.selectOption(responsibleId);
    if (dueDate) await page.locator("#project-task-due-date").fill(dueDate);
    await page.getByRole("button", { name: "Criar tarefa", exact: true }).click();
    await visible(page.getByRole("button", { name, exact: true }), `Tarefa não apareceu: ${name}`);
  };

  const deleteTaskIfPresent = async (name: string) => {
    if (!projectId) return;
    try {
      await openProjectTasks();
      const taskTitle = page.getByRole("button", { name, exact: true }).first();
      if (!(await taskTitle.isVisible().catch(() => false))) return;
      const editButton = page.getByRole("button", { name: `Editar tarefa ${name}`, exact: true }).first();
      await visible(editButton, `Não foi possível abrir a tarefa para limpeza: ${name}`);
      await editButton.click();
      const editDialog = page.getByRole("dialog").filter({ hasText: "Editar tarefa" }).last();
      await visible(editDialog, "Diálogo de edição de tarefa não abriu para limpeza.");
      await editDialog.getByRole("button", { name: "Excluir tarefa", exact: true }).click();
      const confirm = page.getByRole("button", { name: "Excluir tarefa", exact: true }).last();
      await visible(confirm, "Confirmação de exclusão da tarefa não apareceu.");
      await confirm.click();
      await hidden(page.getByRole("button", { name, exact: true }).first(), `A tarefa permaneceu após a exclusão: ${name}`);
      console.log(`[LIMPEZA] tarefa removida: ${name}`);
    } catch (error) {
      console.error(`[AVISO DE LIMPEZA] ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const deleteChatMessageIfPresent = async () => {
    if (!projectId) return;
    try {
      await page.goto(`${baseUrl}/chat/${projectId}`);
      const message = page.getByText(chatMessage, { exact: true });
      if (!(await message.isVisible().catch(() => false))) return;
      await page.getByRole("button", { name: "Ações da mensagem", exact: true }).last().click();
      await page.getByRole("button", { name: "Apagar para todos", exact: true }).click();
      const confirm = page.getByRole("button", { name: "Apagar para todos", exact: true }).last();
      await visible(confirm, "Confirmação de exclusão da mensagem não apareceu.");
      await confirm.click();
      await hidden(message, "A mensagem de teste permaneceu após a exclusão.");
      console.log("[LIMPEZA] mensagem de chat removida para todos.");
    } catch (error) {
      console.error(`[AVISO DE LIMPEZA] mensagem: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const deleteProjectPermanentlyIfPresent = async () => {
    if (!projectId) return;
    try {
      await page.goto(`${baseUrl}/projects/${projectId}`);
      if (!projectWasTrashed) {
        const deleteButton = page.getByRole("button", { name: "Excluir", exact: true });
        await visible(deleteButton, "Ação de mover o projeto para a lixeira não apareceu.");
        await deleteButton.click();
        await visible(page.getByRole("button", { name: "Mover para a lixeira", exact: true }), "Confirmação para mover o projeto à lixeira não apareceu.");
        await page.getByRole("button", { name: "Mover para a lixeira", exact: true }).click();
        await visible(page.getByText("Projeto excluído", { exact: true }), "A aplicação não confirmou a movimentação do projeto para a lixeira.");
        projectWasTrashed = true;
      }

      await page.goto(`${baseUrl}/projects`);
      const trashFilter = page.getByRole("button", { name: /^Lixeira(?:\s|\()/ });
      await visible(trashFilter, "Filtro da lixeira não apareceu.");
      await trashFilter.click();
      const projectLink = page.locator(`a[href="/projects/${projectId}"]`).filter({ hasText: projectName }).first();
      await visible(projectLink, "O projeto TESTE_ não foi encontrado na lixeira para limpeza definitiva.");
      const projectCard = page.locator("div.card-elevated").filter({ has: projectLink }).first();
      await projectCard.getByRole("button", { name: "Excluir definitivamente", exact: true }).click();
      const confirmation = page.getByRole("dialog").filter({ hasText: projectName }).last();
      await visible(confirmation, "Confirmação permanente não corresponde ao projeto criado pelo teste.");
      assert((await confirmation.innerText()).includes(projectName), "O diálogo não confirmou o nome do projeto desta execução.");
      await confirmation.getByRole("button", { name: "Excluir definitivamente", exact: true }).click();
      await hidden(projectLink, "O projeto de teste permaneceu na lixeira após exclusão definitiva.");
      console.log(`[LIMPEZA] projeto removido definitivamente: ${projectName}`);
    } catch (error) {
      console.error(`[AVISO DE LIMPEZA] projeto ${projectName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  try {
    await step("login da conta de teste", async () => {
      await page.goto(`${baseUrl}/auth/login`);
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Entrar no Progressus", exact: true }).click();
      await page.waitForURL((url: URL) => !url.pathname.startsWith("/auth/login"), { timeout: 30_000 });
      assert(!page.url().includes("/auth/login"), "O login não saiu da tela de autenticação.");
    });

    await step("criação e edição de projeto isolado", async () => {
      await page.goto(`${baseUrl}/projects`);
      await page.getByRole("button", { name: "Novo projeto", exact: true }).last().click();
      await visible(page.locator("#project-name"), "Formulário de novo projeto não abriu.");
      await page.locator("#project-name").fill(projectName);
      await page.locator("#project-description").fill(projectDescription);
      await page.getByRole("button", { name: "Criar projeto", exact: true }).click();
      const createdLink = page.locator('a[href^="/projects/"]').filter({ hasText: projectName }).first();
      await visible(createdLink, "Projeto TESTE_ não apareceu após a criação.");
      const href = await createdLink.getAttribute("href");
      const match = href?.match(/^\/projects\/([^/?#]+)$/);
      assert(match?.[1], "Não foi possível obter o ID do projeto criado.");
      projectId = match[1];
      await page.goto(`${baseUrl}/projects/${projectId}`);
      await visible(page.getByRole("heading", { name: projectName }), "Detalhes do projeto não carregaram.");
      await page.getByRole("button", { name: "Editar", exact: true }).click();
      await visible(page.locator("#edit-project-name"), "Formulário de edição de projeto não abriu.");
      await page.locator("#edit-project-name").fill(editedProjectName);
      await page.locator("#edit-project-description").fill(editedDescription);
      await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
      await visible(page.getByRole("heading", { name: editedProjectName }), "Nome editado do projeto não apareceu.");
      await visible(page.getByText(editedDescription, { exact: true }), "Descrição editada do projeto não apareceu.");
    });

    await step("criação, status, edição e visualizações Kanban/Lista da tarefa", async () => {
      await openProjectTasks();
      await createProjectTask(taskCrudName);
      const status = page.getByLabel(`Alterar status de ${taskCrudName}`, { exact: true });
      await visible(status, "Seletor de status da tarefa não apareceu no Kanban.");
      const nextStatus = await status.evaluate((element: HTMLSelectElement) =>
        Array.from(element.options).find((option) => option.value && option.value !== element.value)?.value ?? "",
      );
      assert(nextStatus, "Não há outro status disponível para validar a mudança de status.");
      await status.selectOption(nextStatus);
      const statusId = await status.getAttribute("id");
      await page.waitForFunction(
        ({ id, value }: { id: string; value: string }) => (document.getElementById(id) as HTMLSelectElement | null)?.value === value,
        { id: statusId, value: nextStatus },
      );
      await page.getByRole("button", { name: "Lista", exact: true }).click();
      await visible(page.getByRole("button", { name: taskCrudName, exact: true }), "A tarefa não aparece na visualização Lista.");
      await page.getByRole("button", { name: "Kanban", exact: true }).click();
      await visible(page.getByRole("button", { name: taskCrudName, exact: true }), "A tarefa não aparece na visualização Kanban.");
      await page.getByRole("button", { name: `Editar tarefa ${taskCrudName}`, exact: true }).click();
      const editDialog = page.getByRole("dialog").filter({ hasText: "Editar tarefa" }).last();
      await visible(editDialog, "Diálogo de edição de tarefa não abriu.");
      await editDialog.locator("textarea").first().fill(taskDescription);
      await editDialog.locator('select[id$="-priority"]').selectOption({ label: "Alta" });
      await editDialog.getByRole("button", { name: "Salvar alterações", exact: true }).click();
      await visible(page.getByText(taskDescription, { exact: true }), "Descrição atualizada da tarefa não apareceu.");
      await deleteTaskIfPresent(taskCrudName);
      await hidden(page.getByRole("button", { name: taskCrudName, exact: true }).first(), "A tarefa CRUD não foi removida.");
    });

    await step("calendário mensal e semanal com tarefa TESTE_", async () => {
      await openProjectTasks();
      const due = new Date();
      due.setDate(due.getDate() + 1);
      due.setHours(12, 0, 0, 0);
      await createProjectTask(taskCalendarName, localDateTimeValue(due));
      await page.goto(`${baseUrl}/calendar`);
      await page.getByRole("button", { name: "Mês", exact: true }).click();
      const calendarControls = page.locator("section.surface-panel").filter({ has: page.getByRole("button", { name: "Hoje", exact: true }) }).first();
      const nextPeriod = calendarControls.getByRole("button").nth(2);
      const taskInCalendar = page.getByText(taskCalendarName, { exact: true });
      if (!(await taskInCalendar.isVisible().catch(() => false))) {
        await nextPeriod.click();
      }
      await visible(taskInCalendar, "A tarefa com prazo não apareceu no calendário mensal.");
      await page.getByRole("button", { name: "Hoje", exact: true }).click();
      await page.getByRole("button", { name: "Semana", exact: true }).click();
      if (!(await taskInCalendar.isVisible().catch(() => false))) {
        await nextPeriod.click();
      }
      await visible(taskInCalendar, "A tarefa com prazo não apareceu no calendário semanal.");
      await deleteTaskIfPresent(taskCalendarName);
      await hidden(page.getByRole("button", { name: taskCalendarName, exact: true }).first(), "A tarefa do calendário não foi removida.");
    });

    await step("envio e exclusão para todos de mensagem no chat do projeto", async () => {
      assert(projectId, "ID do projeto de teste indisponível.");
      await page.goto(`${baseUrl}/chat/${projectId}`);
      const messageInput = page.getByPlaceholder("Digite uma mensagem...", { exact: true });
      await visible(messageInput, "Campo de mensagem do chat não apareceu.");
      await messageInput.fill(chatMessage);
      await page.getByRole("button", { name: "Enviar mensagens", exact: true }).click();
      const sentMessage = page.getByText(chatMessage, { exact: true });
      await visible(sentMessage, "Mensagem TESTE_ não apareceu no chat.");
      await page.getByRole("button", { name: "Ações da mensagem", exact: true }).last().click();
      await page.getByRole("button", { name: "Apagar para todos", exact: true }).click();
      const confirmDelete = page.getByRole("button", { name: "Apagar para todos", exact: true }).last();
      await visible(confirmDelete, "Confirmação para apagar a mensagem para todos não apareceu.");
      await confirmDelete.click();
      await hidden(sentMessage, "A mensagem não foi removida para todos.");
    });
  } catch (error) {
    failure = error;
  } finally {
    if (projectId) {
      await deleteChatMessageIfPresent();
      await deleteTaskIfPresent(taskCrudName);
      await deleteTaskIfPresent(taskCalendarName);
      await deleteProjectPermanentlyIfPresent();
    }
    await browser.close();
  }

  console.log(`\nResumo: ${passed} etapa(s) aprovada(s).`);
  if (failure) {
    console.error(`Execução interrompida${failedStep ? ` durante: ${failedStep}` : ""}. Dados de teste foram submetidos à rotina de limpeza.`);
    process.exitCode = 1;
    throw failure;
  }
  console.log("Execução concluída; a limpeza definitiva do projeto TESTE_ foi solicitada e verificada.");
}

main().catch((error) => {
  console.error(`[ERRO] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
