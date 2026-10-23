import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CAPABILITIES, CAPABILITY_BY_KEY, CONFIGURABLE_ROLES, canonicalRole, decide, defaultAllowed, specialtyOf, type CapabilityDef } from "./capabilities";
import { CASE_LIST_ROLES, MANAGEMENT_VIEW_ROLES, REGISTRY_ROLES } from "./permissions";
import { CLINICAL_ROLES, hasRole, type Role } from "./roles";

const none = () => ({ role: new Map<string, boolean>(), user: new Map<string, boolean>() });
const cap = (k: string) => CAPABILITY_BY_KEY[k] as CapabilityDef;

describe("catálogo de capacidades", () => {
  test("chaves únicas, rótulo e descrição preenchidos", () => {
    const keys = CAPABILITIES.map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const c of CAPABILITIES) {
      assert.ok(c.label.length > 3, c.key);
      assert.ok(c.description.length > 5, c.key);
    }
  });

  test("apelidos de perfil viram o perfil canônico", () => {
    assert.equal(canonicalRole("re"), "ppi");
    assert.equal(canonicalRole("medico"), "md1");
    assert.equal(canonicalRole("fonoaudiologa"), "specialist");
    assert.equal(canonicalRole("adm_master"), "admin_platform");
    assert.equal(canonicalRole("diretor"), "school_manager");
  });

  test("padrões espelham a matriz do PM (09/out/2026)", () => {
    const can = (k: string, r: string, sp?: string) => defaultAllowed(cap(k), r, sp);
    // gestão: só o sumário do RE e a lista de encaminhados
    for (const r of ["municipal_manager", "school_manager"]) {
      assert.ok(can("management.view", r));
      assert.ok(!can("case.list", r) && !can("prontuario.consolidado.read", r) && !can("fogap.read", r), r);
    }
    // Board e ADM não leem prontuário
    for (const r of ["board", "admin_platform"]) {
      assert.ok(!can("prontuario.consolidado.read", r) && !can("section.read", r) && !can("vault.reveal", r), r);
    }
    // só o médico decide, delega e encerra
    for (const k of ["case.delegate", "case.close", "case.return"]) {
      assert.ok(can(k, "md1") && !can(k, "ppi") && !can(k, "specialist") && !can(k, "admin_platform"), k);
    }
    // RE cadastra e preenche; não encerra
    assert.ok(can("student.register", "ppi") && can("fogap.fill", "ppi") && !can("case.close", "ppi"));
    // na escola só o RE preenche o FOGAP (decisão da Dra., 23/out): professor e gestor escolar não
    assert.ok(!can("fogap.fill", "teacher") && !can("fogap.fill", "school_manager") && !can("fogap.read", "teacher"));
    // laudos da família (Bloco 5): só RE e médico; especialista, professor, gestão e Board nunca
    for (const k of ["attachments.read", "attachments.write"]) {
      for (const r of ["md1", "ppi", "re", "responsavel_escolar"]) assert.ok(can(k, r), `${k} é do ${r}`);
      for (const r of ["specialist", "teacher", "school_manager", "board", "researcher"]) assert.ok(!can(k, r), `${k} não é do ${r}`);
    }
    // pesquisador: nenhum dado clínico
    for (const c of CAPABILITIES.filter((x) => x.group === "avaliacao_re" || x.group === "medico" || x.group === "dados_sensiveis")) {
      assert.ok(!defaultAllowed(c, "researcher"), c.key);
    }
  });

  test("padrões continuam iguais às listas fixas que existiam antes", () => {
    const legacy: [string, readonly string[]][] = [
      ["student.register", REGISTRY_ROLES],
      ["case.list", CASE_LIST_ROLES],
      ["management.view", MANAGEMENT_VIEW_ROLES],
      ["scales.fill", CLINICAL_ROLES],
      ["vault.reveal", CLINICAL_ROLES],
    ];
    const everyRole: string[] = [...CONFIGURABLE_ROLES, "re", "medico", "fonoaudiologa", "psicologa", "as", "diretor"];
    for (const [key, list] of legacy) {
      for (const r of everyRole) {
        assert.equal(defaultAllowed(cap(key), r), hasRole(r as Role, list), `${key} × ${r}`);
      }
    }
  });

  test("TEA: cada instrumento tem seu preenchedor padrão e a faixa de referência nasce desligada", () => {
    assert.ok(defaultAllowed(cap("tea.ata.fill"), "ppi"));
    assert.ok(defaultAllowed(cap("tea.asq.fill"), "md1"));
    assert.ok(defaultAllowed(cap("tea.mchat.fill"), "specialist", "servico_social"));
    assert.ok(!defaultAllowed(cap("tea.mchat.fill"), "specialist", "fonoaudiologia"));
    assert.ok(defaultAllowed(cap("tea.srs2.fill"), "fonoaudiologa"), "especialidade deduzida do perfil");
    assert.ok(defaultAllowed(cap("tea.abc.fill"), "specialist", "neuropsicologia"));
    for (const r of CONFIGURABLE_ROLES) assert.ok(!defaultAllowed(cap("tea.reference.view"), r), r);
    assert.equal(specialtyOf("psicologa", null), "psicologia");
  });
});

describe("decisão (ordem: travada → pessoa → perfil → padrão)", () => {
  test("padrão quando ninguém configurou", () => {
    assert.deepEqual(decide(cap("case.close"), { role: "md1" }, none()), { allowed: true, source: "default" });
    assert.deepEqual(decide(cap("case.close"), { role: "ppi" }, none()), { allowed: false, source: "default" });
  });

  test("regra do perfil vence o padrão; a da pessoa vence a do perfil", () => {
    const g = none();
    g.role.set("case.close", false);
    assert.deepEqual(decide(cap("case.close"), { role: "md1" }, g), { allowed: false, source: "role" });
    g.user.set("case.close", true);
    assert.deepEqual(decide(cap("case.close"), { role: "md1" }, g), { allowed: true, source: "user" });
  });

  test("capacidade travada: só o Admin Master, e nenhuma caixinha muda isso", () => {
    const g = none();
    g.role.set("privileges.manage", true);
    g.user.set("privileges.manage", true);
    assert.equal(decide(cap("privileges.manage"), { role: "md1" }, g).allowed, false);
    assert.equal(decide(cap("privileges.manage"), { role: "adm_master" }, g).allowed, true);
    const off = none();
    off.role.set("privileges.manage", false);
    assert.equal(decide(cap("privileges.manage"), { role: "admin_platform" }, off).allowed, true);
  });

  test("capacidade por especialidade respeita a exceção do Admin para qualquer especialista", () => {
    const g = none();
    assert.equal(decide(cap("tea.abc.fill"), { role: "specialist", specialty: "fonoaudiologia" }, g).allowed, false);
    g.role.set("tea.abc.fill", true);
    assert.equal(decide(cap("tea.abc.fill"), { role: "specialist", specialty: "fonoaudiologia" }, g).allowed, true);
  });
});
