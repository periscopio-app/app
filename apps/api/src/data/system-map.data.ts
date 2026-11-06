/**
 * Mapa estrutural do código (gerado pelo graphify a partir do AST; sem texto de usuário, sem dados de aluno).
 * Informação técnica de orientação: só o Administrador Master lê, via GET /api/admin/system-map.
 * Para atualizar: rode /graphify e regenere este arquivo.
 */
export interface MapaGrupo { id: number; name: string; size: number; top: { l: string; f: string; d: number }[]; files: string[] }
export interface MapaDoSistema { nodes: number; links: number; communities: number; shown: number; commit: string; geradoEm: string; groups: MapaGrupo[]; edges: [number, number, number][] }

export const SYSTEM_MAP: MapaDoSistema = {
 "nodes": 2885,
 "links": 7127,
 "communities": 133,
 "shown": 103,
 "commit": "78c56eed",
 "groups": [
  {
   "id": 0,
   "name": "Testes E2E da API",
   "size": 93,
   "top": [
    {
     "l": "shared/src/index.ts",
     "f": "packages/shared/src/index.ts",
     "d": 114
    },
    {
     "l": "ref_node_assert",
     "f": "",
     "d": 87
    },
    {
     "l": "ref_node_test",
     "f": "",
     "d": 87
    },
    {
     "l": "client.ts",
     "f": "apps/api/src/db/client.ts",
     "d": 78
    },
    {
     "l": "buildApp()",
     "f": "apps/api/src/app.ts",
     "d": 71
    },
    {
     "l": "ref_drizzle_orm",
     "f": "",
     "d": 63
    }
   ],
   "files": [
    "",
    "apps/api/src/e2e/attachments.e2e.test.ts",
    "apps/api/src/e2e/profile.e2e.test.ts"
   ]
  },
  {
   "id": 1,
   "name": "Catálogo das especialidades (fono, psico…)",
   "size": 81,
   "top": [
    {
     "l": "especialidades-catalog.ts",
     "f": "packages/shared/src/especialidades-catalog.ts",
     "d": 115
    },
    {
     "l": "formsDaEspecialidade()",
     "f": "packages/shared/src/especialidades-catalog.ts",
     "d": 1
    },
    {
     "l": "ADEQ_ALT",
     "f": "packages/shared/src/especialidades-catalog.ts",
     "d": 1
    },
    {
     "l": "ADEQ_DEF_NAV",
     "f": "packages/shared/src/especialidades-catalog.ts",
     "d": 1
    },
    {
     "l": "ADQUIRIU",
     "f": "packages/shared/src/especialidades-catalog.ts",
     "d": 1
    },
    {
     "l": "ADQUIRIU3",
     "f": "packages/shared/src/especialidades-catalog.ts",
     "d": 1
    }
   ],
   "files": [
    "packages/shared/src/especialidades-catalog.ts"
   ]
  },
  {
   "id": 2,
   "name": "Telas por escola e cliente HTTP",
   "size": 66,
   "top": [
    {
     "l": "api.ts",
     "f": "apps/web/lib/api.ts",
     "d": 54
    },
    {
     "l": "medico/page.tsx",
     "f": "apps/web/app/[slug]/dashboard/medico/page.tsx",
     "d": 49
    },
    {
     "l": "api",
     "f": "apps/web/lib/api.ts",
     "d": 41
    },
    {
     "l": "re/page.tsx",
     "f": "apps/web/app/[slug]/dashboard/re/page.tsx",
     "d": 28
    },
    {
     "l": "ApiError",
     "f": "apps/web/lib/api.ts",
     "d": 20
    },
    {
     "l": "lib/capabilities.ts",
     "f": "apps/web/lib/capabilities.ts",
     "d": 16
    }
   ],
   "files": [
    "apps/web/app/[slug]/dashboard/re/page.tsx",
    "apps/web/lib/api.ts",
    "apps/web/app/[slug]/dashboard/medico/page.tsx"
   ]
  },
  {
   "id": 3,
   "name": "Componentes de UI e localidades",
   "size": 65,
   "top": [
    {
     "l": "ui/index.ts",
     "f": "apps/web/components/ui/index.ts",
     "d": 80
    },
    {
     "l": "cn()",
     "f": "apps/web/lib/cn.ts",
     "d": 30
    },
    {
     "l": "LocationSelector.tsx",
     "f": "apps/web/components/ui/LocationSelector.tsx",
     "d": 30
    },
    {
     "l": "demo-select/page.tsx",
     "f": "apps/web/app/demo-select/page.tsx",
     "d": 20
    },
    {
     "l": "Select.tsx",
     "f": "apps/web/components/ui/Select.tsx",
     "d": 15
    },
    {
     "l": "LocationSelector()",
     "f": "apps/web/components/ui/LocationSelector.tsx",
     "d": 14
    }
   ],
   "files": [
    "apps/web/data/locations.ts",
    "apps/web/components/ui/Select.tsx",
    "apps/web/components/ui/LocationSelector.tsx"
   ]
  },
  {
   "id": 4,
   "name": "Serviços de domínio da API",
   "size": 64,
   "top": [
    {
     "l": "pilot-indicators.service.ts",
     "f": "apps/api/src/services/pilot-indicators.service.ts",
     "d": 49
    },
    {
     "l": "pilot-indicators.data.ts",
     "f": "apps/api/src/services/pilot-indicators.data.ts",
     "d": 29
    },
    {
     "l": "pilot-indicators.service.test.ts",
     "f": "apps/api/src/services/pilot-indicators.service.test.ts",
     "d": 25
    },
    {
     "l": "computeAcesso()",
     "f": "apps/api/src/services/pilot-indicators.service.ts",
     "d": 8
    },
    {
     "l": "computeGroup()",
     "f": "apps/api/src/services/pilot-indicators.service.ts",
     "d": 8
    },
    {
     "l": "computeRastreio()",
     "f": "apps/api/src/services/pilot-indicators.service.ts",
     "d": 8
    }
   ],
   "files": [
    "apps/api/src/services/pilot-indicators.service.ts",
    "apps/api/src/services/pilot-indicators.data.ts",
    "apps/api/src/services/pilot-indicators.service.test.ts"
   ]
  },
  {
   "id": 5,
   "name": "Esquema do banco e serviços",
   "size": 58,
   "top": [
    {
     "l": "schema.ts",
     "f": "packages/shared/src/schema.ts",
     "d": 57
    },
    {
     "l": "factory-reset.service.ts",
     "f": "apps/api/src/services/factory-reset.service.ts",
     "d": 42
    },
    {
     "l": "schools",
     "f": "packages/shared/src/schema.ts",
     "d": 19
    },
    {
     "l": "seed-demo.ts",
     "f": "apps/api/scripts/seed-demo.ts",
     "d": 18
    },
    {
     "l": "cases",
     "f": "packages/shared/src/schema.ts",
     "d": 18
    },
    {
     "l": "seed-journey.ts",
     "f": "apps/api/scripts/seed-journey.ts",
     "d": 17
    }
   ],
   "files": [
    "packages/shared/src/schema.ts",
    "apps/api/src/services/factory-reset.service.ts",
    "apps/api/src/services/notifications.service.ts"
   ]
  },
  {
   "id": 6,
   "name": "FOGAP (catálogo e telas)",
   "size": 55,
   "top": [
    {
     "l": "fogap-catalog.ts",
     "f": "packages/shared/src/fogap-catalog.ts",
     "d": 46
    },
    {
     "l": "fogap-faixas.test.ts",
     "f": "apps/api/src/services/fogap-faixas.test.ts",
     "d": 16
    },
    {
     "l": "SumarioFormularioI.tsx",
     "f": "apps/web/components/dashboard/SumarioFormularioI.tsx",
     "d": 14
    },
    {
     "l": "FogapViewer.tsx",
     "f": "apps/web/components/dashboard/FogapViewer.tsx",
     "d": 12
    },
    {
     "l": "faixaEmUso()",
     "f": "packages/shared/src/fogap-catalog.ts",
     "d": 11
    },
    {
     "l": "itensDaFaixa()",
     "f": "packages/shared/src/fogap-catalog.ts",
     "d": 11
    }
   ],
   "files": [
    "packages/shared/src/fogap-catalog.ts",
    "apps/web/components/dashboard/SumarioFormularioI.tsx",
    "apps/web/components/re/FogapComportamentos.tsx"
   ]
  },
  {
   "id": 7,
   "name": "Rotas da API e segurança",
   "size": 54,
   "top": [
    {
     "l": "app.ts",
     "f": "apps/api/src/app.ts",
     "d": 111
    },
    {
     "l": "fastify",
     "f": "apps/api/package.json",
     "d": 61
    },
    {
     "l": "actor.ts",
     "f": "apps/api/src/security/actor.ts",
     "d": 58
    },
    {
     "l": "db",
     "f": "apps/api/src/db/client.ts",
     "d": 51
    },
    {
     "l": "requireCapability()",
     "f": "apps/api/src/security/actor.ts",
     "d": 45
    },
    {
     "l": "recordAudit()",
     "f": "apps/api/src/services/audit.service.ts",
     "d": 38
    }
   ],
   "files": [
    "apps/api/src/routes/newsletter.routes.ts",
    "apps/api/src/routes/support.routes.ts",
    "apps/api/src/security/actor.ts"
   ]
  },
  {
   "id": 8,
   "name": "Assistente do BI (Python, LLM)",
   "size": 53,
   "top": [
    {
     "l": "llm.py",
     "f": "apps/bi-rag/bi_rag/llm.py",
     "d": 23
    },
    {
     "l": "test_llm.py",
     "f": "apps/bi-rag/tests/test_llm.py",
     "d": 18
    },
    {
     "l": "plan_with_llm()",
     "f": "apps/bi-rag/bi_rag/llm.py",
     "d": 17
    },
    {
     "l": "complete_json()",
     "f": "apps/bi-rag/bi_rag/llm.py",
     "d": 13
    },
    {
     "l": "_clear()",
     "f": "apps/bi-rag/tests/test_llm.py",
     "d": 13
    },
    {
     "l": "provider()",
     "f": "apps/bi-rag/bi_rag/llm.py",
     "d": 10
    }
   ],
   "files": [
    "apps/bi-rag/tests/test_llm.py",
    "apps/bi-rag/bi_rag/llm.py",
    "apps/bi-rag/bi_rag/tea.py"
   ]
  },
  {
   "id": 10,
   "name": "Jornada do RE (A a I)",
   "size": 51,
   "top": [
    {
     "l": "re-journey-catalog.ts",
     "f": "packages/shared/src/re-journey-catalog.ts",
     "d": 90
    },
    {
     "l": "situacaoDaJornada()",
     "f": "packages/shared/src/re-journey-catalog.ts",
     "d": 11
    },
    {
     "l": "CampoBase",
     "f": "packages/shared/src/re-journey-catalog.ts",
     "d": 8
    },
    {
     "l": "lacunasDoForm()",
     "f": "packages/shared/src/re-journey-catalog.ts",
     "d": 6
    },
    {
     "l": "lacunasDoSumario()",
     "f": "packages/shared/src/re-journey-catalog.ts",
     "d": 6
    },
    {
     "l": "campoRespondido()",
     "f": "packages/shared/src/re-journey-catalog.ts",
     "d": 5
    }
   ],
   "files": [
    "packages/shared/src/re-journey-catalog.ts",
    "packages/shared/src/especialidades-catalog.ts"
   ]
  },
  {
   "id": 9,
   "name": "CI/CD (GitHub Actions)",
   "size": 51,
   "top": [
    {
     "l": "with",
     "f": ".github/workflows/ci.yml",
     "d": 9
    },
    {
     "l": "env",
     "f": ".github/workflows/ci.yml",
     "d": 8
    },
    {
     "l": "steps",
     "f": ".github/workflows/ci.yml",
     "d": 6
    },
    {
     "l": "steps",
     "f": ".github/workflows/ci.yml",
     "d": 6
    },
    {
     "l": "steps",
     "f": ".github/workflows/ci.yml",
     "d": 6
    },
    {
     "l": "steps",
     "f": ".github/workflows/ci.yml",
     "d": 6
    }
   ],
   "files": [
    ".github/workflows/ci.yml"
   ]
  },
  {
   "id": 11,
   "name": "Serviços e rotas de casos",
   "size": 45,
   "top": [
    {
     "l": "bi.routes.ts",
     "f": "apps/api/src/routes/bi.routes.ts",
     "d": 65
    },
    {
     "l": "bi-semantic.service.ts",
     "f": "apps/api/src/services/bi-semantic.service.ts",
     "d": 33
    },
    {
     "l": "biRoutes()",
     "f": "apps/api/src/routes/bi.routes.ts",
     "d": 15
    },
    {
     "l": "bi-semantic.test.ts",
     "f": "apps/api/src/services/bi-semantic.test.ts",
     "d": 10
    },
    {
     "l": "loadFacts()",
     "f": "apps/api/src/routes/bi.routes.ts",
     "d": 7
    },
    {
     "l": "execute()",
     "f": "apps/api/src/routes/bi.routes.ts",
     "d": 6
    }
   ],
   "files": [
    "apps/api/src/services/bi-semantic.service.ts",
    "apps/api/src/routes/bi.routes.ts",
    "apps/api/src/services/bi-semantic.test.ts"
   ]
  },
  {
   "id": 12,
   "name": "Observabilidade e serviços",
   "size": 44,
   "top": [
    {
     "l": "grafana.service.ts",
     "f": "apps/api/src/services/grafana.service.ts",
     "d": 35
    },
    {
     "l": "observability.routes.ts",
     "f": "apps/api/src/routes/observability.routes.ts",
     "d": 30
    },
    {
     "l": "observabilityRoutes()",
     "f": "apps/api/src/routes/observability.routes.ts",
     "d": 15
    },
    {
     "l": "grafana.service.test.ts",
     "f": "apps/api/src/services/grafana.service.test.ts",
     "d": 12
    },
    {
     "l": "fetchGrafanaStats()",
     "f": "apps/api/src/services/grafana.service.ts",
     "d": 8
    },
    {
     "l": "fetchGrafanaDeploys()",
     "f": "apps/api/src/services/grafana.service.ts",
     "d": 7
    }
   ],
   "files": [
    "apps/api/src/services/grafana.service.ts",
    "apps/api/src/observability/metrics-auth.ts",
    "apps/api/src/routes/observability.routes.ts"
   ]
  },
  {
   "id": 13,
   "name": "Base Tarumã e serviços",
   "size": 43,
   "top": [
    {
     "l": "load-individual.ts",
     "f": "apps/api/scripts/taruma/load-individual.ts",
     "d": 31
    },
    {
     "l": "legacy-import.service.ts",
     "f": "apps/api/src/services/legacy-import.service.ts",
     "d": 28
    },
    {
     "l": "legacy-reconcile.service.ts",
     "f": "apps/api/src/services/legacy-reconcile.service.ts",
     "d": 22
    },
    {
     "l": "main()",
     "f": "apps/api/scripts/taruma/load-individual.ts",
     "d": 9
    },
    {
     "l": "reconcileBatch()",
     "f": "apps/api/src/services/legacy-reconcile.service.ts",
     "d": 6
    },
    {
     "l": "deniedColumns()",
     "f": "apps/api/src/services/legacy-import.service.ts",
     "d": 5
    }
   ],
   "files": [
    "apps/api/src/services/legacy-import.service.ts",
    "apps/api/scripts/taruma/load-individual.ts",
    "apps/api/src/services/legacy-reconcile.service.ts"
   ]
  },
  {
   "id": 14,
   "name": "Privilégios e segurança",
   "size": 43,
   "top": [
    {
     "l": "roles.ts",
     "f": "apps/api/src/security/roles.ts",
     "d": 36
    },
    {
     "l": "attachments.routes.ts",
     "f": "apps/api/src/routes/attachments.routes.ts",
     "d": 25
    },
    {
     "l": "hasRole()",
     "f": "apps/api/src/security/roles.ts",
     "d": 19
    },
    {
     "l": "attachment.service.ts",
     "f": "apps/api/src/services/attachment.service.ts",
     "d": 19
    },
    {
     "l": "Role",
     "f": "apps/api/src/security/roles.ts",
     "d": 17
    },
    {
     "l": "full-system-e2e-simulation.test.ts",
     "f": "apps/api/src/services/full-system-e2e-simulation.test.ts",
     "d": 14
    }
   ],
   "files": [
    "apps/api/src/services/attachment.service.ts",
    "apps/api/src/security/roles.ts",
    "apps/api/src/services/clinical-workflow.service.ts"
   ]
  },
  {
   "id": 15,
   "name": "Landing page",
   "size": 43,
   "top": [
    {
     "l": "Home.tsx",
     "f": "apps/web/components/landing-v2/Home.tsx",
     "d": 23
    },
    {
     "l": "EquipeSection.tsx",
     "f": "apps/web/components/landing-v2/EquipeSection.tsx",
     "d": 12
    },
    {
     "l": "SiteLayout.tsx",
     "f": "apps/web/components/SiteLayout.tsx",
     "d": 11
    },
    {
     "l": "Home()",
     "f": "apps/web/components/landing-v2/Home.tsx",
     "d": 8
    },
    {
     "l": "equipe.ts",
     "f": "apps/web/lib/equipe.ts",
     "d": 8
    },
    {
     "l": "SiteLayout()",
     "f": "apps/web/components/SiteLayout.tsx",
     "d": 7
    }
   ],
   "files": [
    "apps/web/components/landing-v2/Home.tsx",
    "apps/web/components/landing-v2/EquipeSection.tsx",
    "apps/web/lib/equipe.ts"
   ]
  },
  {
   "id": 16,
   "name": "Serviços de casos clínicos",
   "size": 42,
   "top": [
    {
     "l": "profile.routes.ts",
     "f": "apps/api/src/routes/profile.routes.ts",
     "d": 30
    },
    {
     "l": "avatar.service.ts",
     "f": "apps/api/src/services/avatar.service.ts",
     "d": 25
    },
    {
     "l": "profileRoutes()",
     "f": "apps/api/src/routes/profile.routes.ts",
     "d": 16
    },
    {
     "l": "avatar.service.test.ts",
     "f": "apps/api/src/services/avatar.service.test.ts",
     "d": 16
    },
    {
     "l": "validarFoto()",
     "f": "apps/api/src/services/avatar.service.ts",
     "d": 8
    },
    {
     "l": "profile.service.ts",
     "f": "apps/api/src/services/profile.service.ts",
     "d": 8
    }
   ],
   "files": [
    "apps/api/src/services/avatar.service.ts",
    "apps/api/src/services/profile.service.ts",
    "apps/api/src/services/avatar.service.test.ts"
   ]
  },
  {
   "id": 17,
   "name": "Carga Tarumã (scripts)",
   "size": 41,
   "top": [
    {
     "l": "individual_extract.py",
     "f": "apps/api/scripts/taruma/individual_extract.py",
     "d": 38
    },
    {
     "l": "build_manifest_and_lines()",
     "f": "apps/api/scripts/taruma/individual_extract.py",
     "d": 23
    },
    {
     "l": "suggest()",
     "f": "apps/api/scripts/taruma/individual_extract.py",
     "d": 9
    },
    {
     "l": "main()",
     "f": "apps/api/scripts/taruma/individual_extract.py",
     "d": 8
    },
    {
     "l": "Geocoder",
     "f": "apps/api/scripts/taruma/individual_extract.py",
     "d": 7
    },
    {
     "l": "norm()",
     "f": "apps/api/scripts/taruma/individual_extract.py",
     "d": 7
    }
   ],
   "files": [
    "apps/api/scripts/taruma/individual_extract.py",
    ""
   ]
  },
  {
   "id": 18,
   "name": "E-mail e autenticação",
   "size": 41,
   "top": [
    {
     "l": "auth/index.ts",
     "f": "apps/api/src/auth/index.ts",
     "d": 18
    },
    {
     "l": "templates.ts",
     "f": "apps/api/src/email/templates.ts",
     "d": 16
    },
    {
     "l": "leads.routes.ts",
     "f": "apps/api/src/routes/leads.routes.ts",
     "d": 12
    },
    {
     "l": "sendEmail()",
     "f": "apps/api/src/email/index.ts",
     "d": 10
    },
    {
     "l": "escapeHtml()",
     "f": "apps/api/src/email/templates.ts",
     "d": 8
    },
    {
     "l": "layout()",
     "f": "apps/api/src/email/templates.ts",
     "d": 7
    }
   ],
   "files": [
    "apps/api/src/email/templates.ts",
    "apps/api/src/auth/index.ts",
    "apps/api/src/auth/secret.ts"
   ]
  },
  {
   "id": 19,
   "name": "Painel administrativo",
   "size": 41,
   "top": [
    {
     "l": "Button()",
     "f": "apps/web/components/ui/Button.tsx",
     "d": 73
    },
    {
     "l": "saude/page.tsx",
     "f": "apps/web/app/admin/saude/page.tsx",
     "d": 24
    },
    {
     "l": "FactoryResetCard.tsx",
     "f": "apps/web/components/admin/FactoryResetCard.tsx",
     "d": 13
    },
    {
     "l": "lgpd/page.tsx",
     "f": "apps/web/app/admin/lgpd/page.tsx",
     "d": 11
    },
    {
     "l": "admin/newsletter/page.tsx",
     "f": "apps/web/app/admin/newsletter/page.tsx",
     "d": 10
    },
    {
     "l": "AdminSaudePage()",
     "f": "apps/web/app/admin/saude/page.tsx",
     "d": 9
    }
   ],
   "files": [
    "apps/web/app/admin/saude/page.tsx",
    "apps/web/components/admin/FactoryResetCard.tsx",
    "apps/web/app/admin/lgpd/page.tsx"
   ]
  },
  {
   "id": 20,
   "name": "Cursos e convites",
   "size": 40,
   "top": [
    {
     "l": "react",
     "f": "apps/web/package.json",
     "d": 83
    },
    {
     "l": "ref_next",
     "f": "",
     "d": 41
    },
    {
     "l": "auth-client.ts",
     "f": "apps/web/lib/auth-client.ts",
     "d": 10
    },
    {
     "l": "PasswordInput()",
     "f": "apps/web/components/PasswordInput.tsx",
     "d": 9
    },
    {
     "l": "resetMe()",
     "f": "apps/web/lib/capabilities.ts",
     "d": 9
    },
    {
     "l": "app/login/page.tsx",
     "f": "apps/web/app/login/page.tsx",
     "d": 9
    }
   ],
   "files": [
    "apps/web/components/lms/CourseCatalog.tsx",
    "apps/web/app/convite/page.tsx",
    "apps/web/app/verificar-acesso/page.tsx"
   ]
  },
  {
   "id": 21,
   "name": "Painel do RE",
   "size": 40,
   "top": [
    {
     "l": "ReJourneyPanel.tsx",
     "f": "apps/web/components/re/ReJourneyPanel.tsx",
     "d": 82
    },
    {
     "l": "ReJourneyPanel()",
     "f": "apps/web/components/re/ReJourneyPanel.tsx",
     "d": 35
    },
    {
     "l": "AlunoEdicaoModal.tsx",
     "f": "apps/web/components/re/AlunoEdicaoModal.tsx",
     "d": 15
    },
    {
     "l": "nome-aluno.ts",
     "f": "apps/web/lib/nome-aluno.ts",
     "d": 9
    },
    {
     "l": "AlunoEdicaoModal()",
     "f": "apps/web/components/re/AlunoEdicaoModal.tsx",
     "d": 7
    },
    {
     "l": "useNomeDoAluno()",
     "f": "apps/web/lib/nome-aluno.ts",
     "d": 7
    }
   ],
   "files": [
    "apps/web/components/re/ReJourneyPanel.tsx",
    "apps/web/components/re/AlunoEdicaoModal.tsx",
    "apps/web/lib/nome-aluno.ts"
   ]
  },
  {
   "id": 22,
   "name": "apps/api/src/services ·22",
   "size": 39,
   "top": [
    {
     "l": "re-journey.routes.ts",
     "f": "apps/api/src/routes/re-journey.routes.ts",
     "d": 55
    },
    {
     "l": "re-journey.service.ts",
     "f": "apps/api/src/services/re-journey.service.ts",
     "d": 40
    },
    {
     "l": "reJourneyRoutes()",
     "f": "apps/api/src/routes/re-journey.routes.ts",
     "d": 24
    },
    {
     "l": "re-journey.test.ts",
     "f": "apps/api/src/services/re-journey.test.ts",
     "d": 20
    },
    {
     "l": "sumarioComPadroes()",
     "f": "packages/shared/src/fogap-catalog.ts",
     "d": 14
    },
    {
     "l": "montarPayloadFogap()",
     "f": "apps/api/src/services/re-journey.service.ts",
     "d": 10
    }
   ],
   "files": [
    "apps/api/src/services/re-journey.service.ts",
    "packages/shared/src/re-journey-catalog.ts",
    "apps/api/src/routes/re-journey.routes.ts"
   ]
  },
  {
   "id": 23,
   "name": "apps/web/components/perfil",
   "size": 39,
   "top": [
    {
     "l": "MeuPainel.tsx",
     "f": "apps/web/components/perfil/MeuPainel.tsx",
     "d": 31
    },
    {
     "l": "MeuPainel()",
     "f": "apps/web/components/perfil/MeuPainel.tsx",
     "d": 20
    },
    {
     "l": "FotoPerfil.tsx",
     "f": "apps/web/components/perfil/FotoPerfil.tsx",
     "d": 14
    },
    {
     "l": "MetricasPerfil.tsx",
     "f": "apps/web/components/perfil/MetricasPerfil.tsx",
     "d": 14
    },
    {
     "l": "perfil.ts",
     "f": "apps/web/lib/perfil.ts",
     "d": 14
    },
    {
     "l": "Alert()",
     "f": "apps/web/components/ui/Alert.tsx",
     "d": 13
    }
   ],
   "files": [
    "apps/web/lib/perfil.ts",
    "apps/web/components/perfil/MeuPainel.tsx",
    "apps/web/components/perfil/MetricasPerfil.tsx"
   ]
  },
  {
   "id": 24,
   "name": "apps/api/src/routes ·24",
   "size": 37,
   "top": [
    {
     "l": "pilot-indicators.routes.ts",
     "f": "apps/api/src/routes/pilot-indicators.routes.ts",
     "d": 47
    },
    {
     "l": "canAccessSchool()",
     "f": "apps/api/src/security/tenancy.ts",
     "d": 25
    },
    {
     "l": "triagem.routes.ts",
     "f": "apps/api/src/routes/triagem.routes.ts",
     "d": 20
    },
    {
     "l": "isSuperAdminEmail()",
     "f": "apps/api/src/security/roles.ts",
     "d": 19
    },
    {
     "l": "evaluations.routes.ts",
     "f": "apps/api/src/routes/evaluations.routes.ts",
     "d": 18
    },
    {
     "l": "tenancy.ts",
     "f": "apps/api/src/security/tenancy.ts",
     "d": 16
    }
   ],
   "files": [
    "apps/api/src/routes/pilot-indicators.routes.ts",
    "apps/api/src/services/evaluation-guard.ts",
    "apps/api/src/services/triagem.service.ts"
   ]
  },
  {
   "id": 25,
   "name": "apps/api/src/services ·25",
   "size": 36,
   "top": [
    {
     "l": "cases.routes.ts",
     "f": "apps/api/src/routes/cases.routes.ts",
     "d": 93
    },
    {
     "l": "casesRoutes()",
     "f": "apps/api/src/routes/cases.routes.ts",
     "d": 36
    },
    {
     "l": "student-code.ts",
     "f": "apps/api/src/services/student-code.ts",
     "d": 14
    },
    {
     "l": "can()",
     "f": "apps/api/src/services/privilege.service.ts",
     "d": 12
    },
    {
     "l": "caseVisibleTo()",
     "f": "apps/api/src/routes/cases.routes.ts",
     "d": 10
    },
    {
     "l": "ageBracketOf()",
     "f": "apps/api/src/services/student-code.ts",
     "d": 9
    }
   ],
   "files": [
    "apps/api/src/routes/cases.routes.ts",
    "apps/api/src/services/student-code.ts",
    "apps/api/src/services/student-name.service.ts"
   ]
  },
  {
   "id": 26,
   "name": "packages/shared/src/medico-forms-catalog.ts ·26",
   "size": 36,
   "top": [
    {
     "l": "medico-forms-catalog.ts",
     "f": "packages/shared/src/medico-forms-catalog.ts",
     "d": 48
    },
    {
     "l": "lerSimNao()",
     "f": "packages/shared/src/medico-forms-catalog.ts",
     "d": 7
    },
    {
     "l": "camposBiografia()",
     "f": "packages/shared/src/medico-forms-catalog.ts",
     "d": 5
    },
    {
     "l": "CampoMd()",
     "f": "apps/web/components/medico/MedicoFormsPanel.tsx",
     "d": 4
    },
    {
     "l": "normalizarCampo()",
     "f": "packages/shared/src/medico-forms-catalog.ts",
     "d": 4
    },
    {
     "l": "esc()",
     "f": "packages/shared/src/medico-forms-catalog.ts",
     "d": 3
    }
   ],
   "files": [
    "packages/shared/src/medico-forms-catalog.ts",
    "apps/web/components/medico/MedicoFormsPanel.tsx"
   ]
  },
  {
   "id": 27,
   "name": "apps/api/src/services ·27",
   "size": 35,
   "top": [
    {
     "l": "privileges.routes.ts",
     "f": "apps/api/src/routes/privileges.routes.ts",
     "d": 46
    },
    {
     "l": "privilege.service.ts",
     "f": "apps/api/src/services/privilege.service.ts",
     "d": 42
    },
    {
     "l": "canonicalRole()",
     "f": "apps/api/src/security/capabilities.ts",
     "d": 20
    },
    {
     "l": "privilegesRoutes()",
     "f": "apps/api/src/routes/privileges.routes.ts",
     "d": 16
    },
    {
     "l": "decideCapability()",
     "f": "apps/api/src/services/privilege.service.ts",
     "d": 15
    },
    {
     "l": "decide()",
     "f": "apps/api/src/security/capabilities.ts",
     "d": 9
    }
   ],
   "files": [
    "apps/api/src/routes/privileges.routes.ts",
    "apps/api/src/security/capabilities.ts",
    "apps/api/src/services/privilege.service.ts"
   ]
  },
  {
   "id": 28,
   "name": "packages/shared/src/genograma.ts",
   "size": 35,
   "top": [
    {
     "l": "genograma.ts",
     "f": "packages/shared/src/genograma.ts",
     "d": 35
    },
    {
     "l": "genograma.test.ts",
     "f": "apps/api/src/services/genograma.test.ts",
     "d": 23
    },
    {
     "l": "GenogramaEditor.tsx",
     "f": "apps/web/components/genograma/GenogramaEditor.tsx",
     "d": 22
    },
    {
     "l": "GenogramaEditor()",
     "f": "apps/web/components/genograma/GenogramaEditor.tsx",
     "d": 13
    },
    {
     "l": "normalizarGenograma()",
     "f": "packages/shared/src/genograma.ts",
     "d": 10
    },
    {
     "l": "normalizarGenogramaTexto()",
     "f": "packages/shared/src/genograma.ts",
     "d": 8
    }
   ],
   "files": [
    "packages/shared/src/genograma.ts",
    "apps/api/src/services/genograma.test.ts",
    "apps/web/components/genograma/GenogramaEditor.tsx"
   ]
  },
  {
   "id": 29,
   "name": "apps/api/src/observability ·29",
   "size": 33,
   "top": [
    {
     "l": "access.routes.ts",
     "f": "apps/api/src/routes/access.routes.ts",
     "d": 26
    },
    {
     "l": "http.ts",
     "f": "apps/api/src/observability/http.ts",
     "d": 18
    },
    {
     "l": "metrics.test.ts",
     "f": "apps/api/src/observability/metrics.test.ts",
     "d": 16
    },
    {
     "l": "accessRoutes()",
     "f": "apps/api/src/routes/access.routes.ts",
     "d": 13
    },
    {
     "l": "ref_node_crypto",
     "f": "",
     "d": 11
    },
    {
     "l": "rate-limit.ts",
     "f": "apps/api/src/security/rate-limit.ts",
     "d": 10
    }
   ],
   "files": [
    "apps/api/src/observability/http.ts",
    "apps/api/src/auth/access-link.ts",
    "apps/api/src/security/rate-limit.ts"
   ]
  },
  {
   "id": 31,
   "name": "apps/api/src/services ·31",
   "size": 32,
   "top": [
    {
     "l": "management.routes.ts",
     "f": "apps/api/src/routes/management.routes.ts",
     "d": 39
    },
    {
     "l": "re-observability.service.ts",
     "f": "apps/api/src/services/re-observability.service.ts",
     "d": 21
    },
    {
     "l": "managementRoutes()",
     "f": "apps/api/src/routes/management.routes.ts",
     "d": 10
    },
    {
     "l": "auditLogs",
     "f": "packages/shared/src/schema.ts",
     "d": 10
    },
    {
     "l": "mediana()",
     "f": "apps/api/src/services/re-observability.service.ts",
     "d": 8
    },
    {
     "l": "re-observability.test.ts",
     "f": "apps/api/src/services/re-observability.test.ts",
     "d": 7
    }
   ],
   "files": [
    "apps/api/src/services/re-observability.service.ts",
    "apps/api/src/routes/management.routes.ts",
    "packages/shared/src/schema.ts"
   ]
  },
  {
   "id": 30,
   "name": "apps/api/package.json ·30",
   "size": 32,
   "top": [
    {
     "l": "api/package.json",
     "f": "apps/api/package.json",
     "d": 28
    },
    {
     "l": "dependencies",
     "f": "apps/api/package.json",
     "d": 14
    },
    {
     "l": "@fastify/cors",
     "f": "apps/api/package.json",
     "d": 3
    },
    {
     "l": "@fastify/swagger",
     "f": "apps/api/package.json",
     "d": 3
    },
    {
     "l": "@fastify/swagger-ui",
     "f": "apps/api/package.json",
     "d": 3
    },
    {
     "l": "@supabase/supabase-js",
     "f": "apps/api/package.json",
     "d": 3
    }
   ],
   "files": [
    "apps/api/package.json"
   ]
  },
  {
   "id": 32,
   "name": "apps/api/src/storage",
   "size": 31,
   "top": [
    {
     "l": "storage/index.ts",
     "f": "apps/api/src/storage/index.ts",
     "d": 22
    },
    {
     "l": "storage-check.service.ts",
     "f": "apps/api/src/services/storage-check.service.ts",
     "d": 20
    },
    {
     "l": "config.ts",
     "f": "apps/api/src/storage/config.ts",
     "d": 10
    },
    {
     "l": "runStorageCheck()",
     "f": "apps/api/src/services/storage-check.service.ts",
     "d": 8
    },
    {
     "l": "describeNetworkError()",
     "f": "apps/api/src/storage/config.ts",
     "d": 8
    },
    {
     "l": "networkErrorCode()",
     "f": "apps/api/src/storage/config.ts",
     "d": 8
    }
   ],
   "files": [
    "apps/api/src/storage/index.ts",
    "apps/api/src/services/storage-check.service.ts",
    "apps/api/src/storage/config.ts"
   ]
  },
  {
   "id": 33,
   "name": "apps/web/components/re",
   "size": 31,
   "top": [
    {
     "l": "ReFormRenderer.tsx",
     "f": "apps/web/components/re/ReFormRenderer.tsx",
     "d": 31
    },
    {
     "l": "EspecialidadeFormsPanel.tsx",
     "f": "apps/web/components/especialista/EspecialidadeFormsPanel.tsx",
     "d": 25
    },
    {
     "l": "EspecialidadesDevolutiva.tsx",
     "f": "apps/web/components/medico/EspecialidadesDevolutiva.tsx",
     "d": 19
    },
    {
     "l": "EspecialidadeFormsPanel()",
     "f": "apps/web/components/especialista/EspecialidadeFormsPanel.tsx",
     "d": 12
    },
    {
     "l": "isEspecialidadeId()",
     "f": "packages/shared/src/especialidades-catalog.ts",
     "d": 12
    },
    {
     "l": "ReFormLeitura()",
     "f": "apps/web/components/re/ReFormRenderer.tsx",
     "d": 10
    }
   ],
   "files": [
    "apps/web/components/re/ReFormRenderer.tsx",
    "apps/web/components/especialista/EspecialidadeFormsPanel.tsx",
    "apps/web/components/medico/EspecialidadesDevolutiva.tsx"
   ]
  },
  {
   "id": 34,
   "name": "apps/api/src/services ·34",
   "size": 30,
   "top": [
    {
     "l": "taruma-dashboard.service.ts",
     "f": "apps/api/src/services/taruma-dashboard.service.ts",
     "d": 20
    },
    {
     "l": "population-planning.service.ts",
     "f": "apps/api/src/services/population-planning.service.ts",
     "d": 16
    },
    {
     "l": "taruma-dashboard.test.ts",
     "f": "apps/api/src/services/taruma-dashboard.test.ts",
     "d": 11
    },
    {
     "l": "buildTarumaDashboard()",
     "f": "apps/api/src/services/taruma-dashboard.service.ts",
     "d": 8
    },
    {
     "l": "population-planning.test.ts",
     "f": "apps/api/src/services/population-planning.test.ts",
     "d": 8
    },
    {
     "l": "planSchool()",
     "f": "apps/api/src/services/population-planning.service.ts",
     "d": 7
    }
   ],
   "files": [
    "apps/api/src/services/taruma-dashboard.service.ts",
    "apps/api/src/services/population-planning.service.ts",
    "apps/api/src/services/taruma-dashboard.test.ts"
   ]
  },
  {
   "id": 35,
   "name": "apps/bi-rag/app.py",
   "size": 30,
   "top": [
    {
     "l": "app.py",
     "f": "apps/bi-rag/app.py",
     "d": 23
    },
    {
     "l": "collect()",
     "f": "apps/bi-rag/bi_rag/usage.py",
     "d": 8
    },
    {
     "l": "test_gasto_de_tokens_e_registrado_por_chamada_sem_guardar_texto()",
     "f": "apps/bi-rag/tests/test_llm.py",
     "d": 8
    },
    {
     "l": "test_gemini_soma_tokens_de_raciocinio_na_saida()",
     "f": "apps/bi-rag/tests/test_llm.py",
     "d": 8
    },
    {
     "l": "usage.py",
     "f": "apps/bi-rag/bi_rag/usage.py",
     "d": 8
    },
    {
     "l": "plan()",
     "f": "apps/bi-rag/app.py",
     "d": 7
    }
   ],
   "files": [
    "apps/bi-rag/app.py",
    "apps/bi-rag/tests/test_llm.py",
    ""
   ]
  }
 ],
 "edges": [
  [
   0,
   25,
   7
  ],
  [
   0,
   29,
   21
  ],
  [
   0,
   27,
   14
  ],
  [
   0,
   7,
   109
  ],
  [
   0,
   12,
   8
  ],
  [
   18,
   29,
   6
  ],
  [
   7,
   29,
   20
  ],
  [
   7,
   14,
   29
  ],
  [
   14,
   25,
   4
  ],
  [
   7,
   11,
   7
  ],
  [
   11,
   24,
   7
  ],
  [
   11,
   34,
   5
  ],
  [
   7,
   25,
   14
  ],
  [
   24,
   25,
   9
  ],
  [
   25,
   27,
   9
  ],
  [
   22,
   25,
   24
  ],
  [
   6,
   25,
   10
  ],
  [
   7,
   24,
   39
  ],
  [
   5,
   7,
   28
  ],
  [
   27,
   31,
   6
  ],
  [
   7,
   31,
   9
  ],
  [
   7,
   12,
   10
  ],
  [
   12,
   32,
   6
  ],
  [
   7,
   18,
   15
  ],
  [
   4,
   24,
   13
  ],
  [
   14,
   24,
   13
  ],
  [
   7,
   27,
   21
  ],
  [
   7,
   16,
   14
  ],
  [
   21,
   22,
   16
  ],
  [
   6,
   22,
   18
  ],
  [
   7,
   22,
   11
  ],
  [
   24,
   27,
   4
  ],
  [
   14,
   27,
   5
  ],
  [
   10,
   22,
   19
  ],
  [
   17,
   35,
   4
  ],
  [
   8,
   35,
   16
  ],
  [
   2,
   19,
   20
  ],
  [
   2,
   21,
   14
  ],
  [
   19,
   33,
   6
  ],
  [
   19,
   20,
   15
  ],
  [
   26,
   28,
   5
  ],
  [
   19,
   23,
   4
  ],
  [
   3,
   23,
   17
  ],
  [
   20,
   23,
   7
  ],
  [
   28,
   33,
   3
  ],
  [
   10,
   21,
   7
  ],
  [
   6,
   21,
   23
  ],
  [
   21,
   33,
   8
  ],
  [
   3,
   19,
   10
  ],
  [
   6,
   10,
   6
  ],
  [
   2,
   3,
   5
  ],
  [
   0,
   5,
   23
  ],
  [
   0,
   28,
   5
  ],
  [
   0,
   6,
   13
  ],
  [
   0,
   14,
   19
  ],
  [
   0,
   16,
   9
  ],
  [
   7,
   30,
   5
  ],
  [
   5,
   25,
   19
  ],
  [
   5,
   13,
   6
  ],
  [
   5,
   14,
   3
  ],
  [
   11,
   31,
   5
  ],
  [
   5,
   11,
   5
  ],
  [
   25,
   31,
   3
  ],
  [
   4,
   7,
   3
  ],
  [
   5,
   24,
   9
  ],
  [
   22,
   31,
   7
  ],
  [
   5,
   31,
   12
  ],
  [
   5,
   27,
   6
  ],
  [
   5,
   16,
   4
  ],
  [
   5,
   22,
   6
  ],
  [
   4,
   5,
   9
  ],
  [
   10,
   28,
   4
  ],
  [
   0,
   13,
   11
  ],
  [
   2,
   20,
   19
  ],
  [
   2,
   33,
   10
  ],
  [
   2,
   23,
   9
  ],
  [
   3,
   21,
   3
  ],
  [
   1,
   10,
   6
  ],
  [
   0,
   18,
   11
  ],
  [
   0,
   11,
   6
  ],
  [
   0,
   24,
   19
  ],
  [
   0,
   31,
   6
  ],
  [
   0,
   22,
   13
  ],
  [
   0,
   4,
   5
  ],
  [
   0,
   34,
   4
  ],
  [
   3,
   20,
   14
  ],
  [
   15,
   20,
   10
  ],
  [
   20,
   33,
   3
  ],
  [
   0,
   33,
   3
  ],
  [
   3,
   33,
   3
  ],
  [
   20,
   21,
   3
  ]
 ],
 "geradoEm": "2026-11-05"
};
