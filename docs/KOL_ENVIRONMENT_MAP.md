# КЁЛь — карта окружений, проверено 25.10.2026

## Единственный путь продолжения

- Основная ветка репозитория: `main`. Она пока не содержит всю работу из открытых PR.
- Выбранный дизайн и Ubuntu Docker: существующая `release/kol-approved-ui-rc1-20261022`, PR #143. Все коммиты PR #141 уже входят в неё.
- Security/CI-исправления: существующая `codex/kol-release-gate-repair`, PR #153. Это источник исправлений для переноса, а не финальная версия выбранного дизайна.
- Продолжать сборку в существующей release-линии, переносить проверенные уникальные исправления и заново проходить CI и визуальную проверку на её коммите.
- PR #145: доставка; #147/#149: изоляция ролей и идемпотентность; #144: сезонные визуалы/concierge. Эти изменения автоматически не приняты.
- Не создавать новые постоянные ветки, Supabase-проекты/ветки и проекты Vercel для продолжения.

## База и проверка восстановления

Единственный найденный Supabase-проект КЁЛь: `kol-travel-platform-test` (`mphruawzozrpwcjgejhs`), ACTIVE_HEALTHY. Development branches: 0. Остальные найденные базы принадлежат другим продуктам.

Для репетиции используется временный локальный Supabase на существующем CI runner. Платная облачная ветка не нужна. Проверенный запуск 40174139141 остановился до создания backup на отсутствии KOL_DATABASE_URL; артефактов нет. До успешного восстановления миграции заблокированы.

## Размещение

Существующий Git-linked preview: `kol-launch-staging-20260925`. Последний проверенный deployment `dpl_3ppgBqRwbVbD7WCZkE9J97dBw8g2`: READY, ветка PR #153, SHA `26c996bf0587d39708f10055b9c77fc1d3f20f95`, target preview. Это не проверка дизайна PR #143.

У остальных 12 проектов в просмотренных последних деплоях нет Git SHA/ref в metadata. Их исходник не установлен; они не являются доказательством текущей готовности. Не удалять и не перенаправлять домены по одному названию.

| Vercel-проект | Назначение по проверке |
| --- | --- |
| kol-freeze-874841b | историческое размещение, исходник не установлен |
| kol-git-probe | историческое размещение, исходник не установлен |
| kol-presentation-20260821 | историческое размещение, исходник не установлен |
| kol-travel-platform | историческое размещение, исходник не установлен |
| kol-demo-entry-20260826 | историческое размещение, исходник не установлен |
| kol-travel-platform-app | историческое размещение, исходник не установлен |
| kol-launch-staging-20260925 | Git preview PR #153 |
| kol-freeze-874841b-preview | историческое размещение, исходник не установлен |
| kol-travel-freeze-874841b | историческое размещение, исходник не установлен |
| kol-freeze-874841b-test | историческое размещение, исходник не установлен |
| kol-freeze-bootstrap-probe | историческое размещение, исходник не установлен |
| kol-travel-freeze-preview-874841b | историческое размещение, исходник не установлен |
| kol-file-path-capability-probe | историческое размещение, исходник не установлен |

## Выполненная настройка маршрута работ

- PR #141 закрыт как полностью включённый в #143; ветка и история сохранены. Dockerfile и Docker workflow в них совпадают по blob SHA.
- В #147/#149 убрано требование платной ветки; тесты направлены на временный локальный CI runner.
- В #143/#153 явно разделены approved UI, security donor, база и preview host.
- Runtime flags, домены, production, данные базы и секреты этой проверкой не менялись.

## Инвентаризация Git

154 ветки без символического origin/HEAD; 40 вспомогательных веток входят в main по ancestry. Удаление не выполнялось: само включение в main не доказывает отсутствие внешних ссылок.

| Ветка | SHA | Входит в main |
| --- | --- | --- |
| `audit/kol-stage2-security-tests-20261022` | `d95c552c1767e5138fa3da015d9d2fbc289b6741` | нет |
| `chore/actions-node24-runtime` | `26e587e9bee82e12d4e3efd29e6cd09baf26b56f` | нет |
| `chore/kol-ci-bootstrap-20260820` | `87706724aa7a91ef7cf43786ae116ef5382d3bcf` | нет |
| `chore/kol-ci-runtime-eslint-20260820` | `48e033ef8ca1b6fcece1d7832e6c3b9d8da5ee9c` | нет |
| `chore/kol-dev-audit-diagnostic-20260821` | `bc39a469a83e4ac8f0ea5345e00d42ff3110c7ea` | нет |
| `chore/kol-eslint-link-rule-cleanup-20260821` | `a8f22984e67b58bb95223d6df9881d010e379140` | нет |
| `chore/next16-config-cleanup` | `e15e07e248783a975f290bb17ea6f36c42607a2e` | нет |
| `chore/npm-install-script-policy` | `3e7a030045314bab9766fad1066ca871ef767e4e` | да |
| `chore/presentation-direct-image-lint` | `6409b1a5fd06e4f10ccad5bf32bc9ac4bcbdef65` | да |
| `codex/fail-closed-production-gate-2026-09-29` | `1afccb430874a373dee5c38fb2d3dc9d68c8c4d3` | нет |
| `codex/fix-dev-audit-2026-09-30` | `d752b296c0ce12a986bc520d8ca46da059929587` | нет |
| `codex/fix-kg-copyright-audit-2026-09-29` | `1d0ae723aea7a0e6e19888be11519554a46d0704` | нет |
| `codex/fix-kg-copyright-audit-2026-09-29-v2` | `61f901c0b606141087d9c0035bc534ca5ba6c298` | нет |
| `codex/fix-kg-copyright-audit-2026-09-29-v3` | `29d0ff7dbf59ba705e8dc2609b11a3b1ef7e6377` | нет |
| `codex/fix-kg-copyright-audit-2026-09-29-v4` | `e8f9321c75940de0457e28189a49116cb9c56133` | нет |
| `codex/fix-kg-footer-audit-2026-09-29` | `ce2fede481e268117a3813b0aff5e955cd315fbe` | нет |
| `codex/kol-delivery-catalog-fix-20261007` | `1cc370e2c9b37df64e1712da8ba915be7d7ca133` | нет |
| `codex/kol-delivery-unified-2026-09-30` | `0bbfe64becd12103d2d40ab9f0feb62794acf0c1` | нет |
| `codex/kol-full-plan-2026-09-29` | `d86c19f231e7be58cfacdb928e2d497fcd99c168` | нет |
| `codex/kol-geometry-fix-2026-09-29` | `6053a5909ed2b78af76c2d68f2255402b52639d8` | нет |
| `codex/kol-hero-card-fit-2026-09-29` | `34f3fec78b1a515f562cd10a6a1f45465425550c` | нет |
| `codex/kol-hero-refresh-2026-09-29` | `a8c861e9f3f6f65857e3a2905ca41e3970b4e19d` | нет |
| `codex/kol-i18n-final-20261007` | `8bd503aca8e9b415a04877366d8b58784c658883` | нет |
| `codex/kol-ky-audit-2026-09-29` | `6988167c5f27f217ed1cc621945021f6d0e11069` | нет |
| `codex/kol-ky-final-polish-2026-09-29` | `00542832e1edf3ccd3604ab5b619d9a9fb97a6b3` | нет |
| `codex/kol-launch-2026-09-28` | `070cbff20f58c3829242c299834fed0e41a2b332` | нет |
| `codex/kol-media-hotfix-2026-09-28` | `e373b519445520d8776d6642dc2cb22e3b2ddef0` | нет |
| `codex/kol-onboarding-selected-design-20261008` | `1cc370e2c9b37df64e1712da8ba915be7d7ca133` | нет |
| `codex/kol-onboarding-staging-20261008` | `e120292b28cfb936c78e9f272e86e8900abfb93f` | нет |
| `codex/kol-paladin-image-fix-2026-09-30` | `b5c9beffc60b6be33f837ed2bf407a05ea6e560f` | нет |
| `codex/kol-premium-overlay-fix-2026-09-29` | `e5aa9396967a3a931cfc72eb931e91630c2a0f8f` | нет |
| `codex/kol-premium-seasonal-assets-2026-09-29` | `91136e68e9ce08db1b17ab58f2407f26c16d2a91` | нет |
| `codex/kol-release-gate-repair` | `26c996bf0587d39708f10055b9c77fc1d3f20f95` | нет |
| `codex/kol-remove-benefit-squares-2026-09-29` | `c4313a773ec934202e68d075eedbfce50627bbfc` | нет |
| `codex/kol-responsive-2026-09-29` | `5b1e896abec83cc8db8ebf71d3c4463beb1e2078` | нет |
| `codex/kol-showcase-2026-09-28` | `d7f8e49ce67b0334b51cb6fc062de4b2dc483965` | нет |
| `codex/kol-showcase-fill-2026-09-28` | `ff429c69ae7a6065019ad731ed4c478412584a5b` | нет |
| `demo/kol-presentation-polish-20260826` | `6f1743eabe40202343458d9ab1b2324086aa1d77` | нет |
| `demo/kol-presentation-polish-wave2-20260826` | `a300f41890f8dd13170bcb020063f1d9597a02ce` | нет |
| `demo/kol-presentation-polish-wave3-20260826` | `fc0dd6cee279cb47fc0b9bcb16a2e6375a717c4c` | нет |
| `demo/kol-presentation-polish-wave4-20260826` | `2ad22019e1ff29175cac20e55235592c6f25c7e1` | да |
| `design/kol-premium-ui-2026-09-29` | `66380c3d6669531f17145a571969e18f780d8fad` | нет |
| `docs/current-kol-status-20260829` | `820cbc87bfd60e78da451a107274ba1a88f6c24d` | нет |
| `docs/kol-live-baseline-staging-runbook-20260821` | `1090f2f39cb8d6cb1c12389db6688a49e7dbf150` | нет |
| `docs/kol-master-context-v4-20260820` | `be33049a62a7683d311fec184ed6c3ad3a6506b7` | нет |
| `docs/kol-master-context-v5-20260820` | `07e05b923e057ff9174468861ba59534fad64296` | да |
| `docs/kol-master-context-v5-20260821` | `26b5f2f8d4afdb67b46371fdd7b6ec44e0a81243` | нет |
| `docs/kol-master-context-v6-20260821` | `1f2acc1af8ddcd9baab8cb408f58911338ae8b0d` | нет |
| `feat/admin-catalog-governance-runtime` | `65a1cbf8dbeeb1aef8985cfe8fa04a2250972d92` | да |
| `feat/admin-catalog-moderation` | `c038bbea590698ab1ff57ffc76de0aac3116f9b1` | нет |
| `feat/admin-catalog-moderation-current-main` | `f7a3a43e44653b49778318d29a51e582af5f39e2` | нет |
| `feat/admin-catalog-moderation-v2` | `cabc8ab2c0f9eeebac7e2f34c59c5341fa63c2fe` | да |
| `feat/admin-support-lifecycle` | `068f8ef3e1a1fb194d33e1034adcc2da372d88e0` | да |
| `feat/atomic-client-booking-2026-09-28` | `19da732d4ca4c8f6d4f1364bc957d6de5884ecd6` | нет |
| `feat/client-navigation-delivery-2026-09-28` | `647cf1c1432a84dd2c97551a4bd5f14097f09eae` | нет |
| `feat/client-profile-runtime` | `580d7867d8544a0147e3333e33b6ce459703d3fe` | да |
| `feat/client-support-runtime` | `3c09e42da72f5fdaf5c6bbf6a03afcbf7e78ddb5` | да |
| `feat/kol-brand-system-2026-09-28` | `7498eeae8d6e8b74fbf8a685b4cf8d916fef838b` | нет |
| `feat/kol-hotel-visual-cards-2026-09-28` | `c3777d4d4e1d1595c73ace7b62d64c53917134fe` | нет |
| `feat/kol-visual-home-2026-09-28` | `e8a0aed3d38bd0f92767a125afa0c2ed76d9a3d0` | нет |
| `feat/partner-availability-runtime` | `6065f9a800402c40fca2dcbdbc35f5ee4ea7b5c3` | да |
| `feat/partner-booking-completion` | `784589bf4316f2f5ef26fe833299d70ac0284775` | нет |
| `feat/partner-booking-lifecycle` | `8d35de523bf047bc5de68eadea5c24fe738efe68` | да |
| `feat/partner-catalog-availability` | `d8f846937f04128be113e652794163e8dbfd9f5b` | нет |
| `feat/partner-catalog-write-runtime` | `0d6c82b4b6c70f85596f14a1a46766f468a54b8e` | да |
| `feat/partner-order-lifecycle` | `e23fb8250efbd761c94c114fbeb51ef99435d6ac` | да |
| `feat/partner-stop-runtime` | `0dfa8580966bbd238869ab000ea9c893d3a4b837` | нет |
| `feature/chatgpt-issue-50` | `847045ae12a3667370d0e903303e0fa2cd846a1c` | да |
| `feature/chatgpt-issue-56` | `19b5966080ba43b26083c2a5e459b1ffba975d84` | да |
| `feature/chatgpt-issue-57` | `53cbc6dc037ef2e86d206d85dd54c312eb328883` | да |
| `feature/chatgpt-issue-58` | `bd6feb95475a0c037025d02313fb2fe7b5cddcb9` | да |
| `feature/chatgpt-issue-65` | `ace9ef890bbe507fb3963c5030e5d245fe6d77ea` | да |
| `feature/chatgpt-issue-66` | `e65fd1572f7e6750f890681ec15ab1391e0310ed` | нет |
| `feature/chatgpt-issue-68` | `fb778c23b42d8ad4e5c6857d36a4915d90b52c1e` | да |
| `feature/chatgpt-issue-72` | `ea2bed52b9fb0c87cad842e69d16de222a106089` | да |
| `feature/chatgpt-issue-73` | `2e54c4acb4cea5faecbd4a19ae5005517de5fd83` | да |
| `feature/kol-ai-agent-v1` | `b99ae52d8983468c3dc071a4242b2ae0ad69b76f` | нет |
| `feature/kol-booking-transaction-core-20260820` | `5760fdd636b7be0b2d9b0ab16b12e744586d75c7` | нет |
| `feature/kol-booking-transaction-v2-20260820` | `200de6c908ad35c0c8dd16fde3656abb649e111a` | да |
| `feature/kol-catalog-media-storage-20260820` | `1a72a94e5424e2a08e0d94e72452af0c4b35b207` | нет |
| `feature/kol-catalog-media-storage-v2-20260820` | `27ecdf1cfed6c7bbbe724b94d9369ee0f80ec808` | да |
| `feature/kol-client-profile-simplify-20261021` | `a124a2d7de44712062508ad0b37ac9ec0b0683be` | нет |
| `feature/kol-delivery-lifecycle-20260820` | `5a4dbea32a1f18281ea17263b34c9c0fc158c5ee` | нет |
| `feature/kol-delivery-lifecycle-v2-20260820` | `797278d43159d3ab063a0d3784cbd2a4883b7767` | да |
| `feature/kol-final-polish-v1-20260821` | `61f8aed4a122c7141375f5c74858954af550b968` | нет |
| `feature/kol-observability-rollback-20260820` | `ebf8d5e79263d9ea8d1323d8bc026eab1ed76492` | нет |
| `feature/kol-order-transaction-core-20260820` | `e60deace7071d04e86c5d1b9cef1b807dabc99c5` | нет |
| `feature/kol-order-transaction-v2-20260820` | `cd4cfde5fdcb2246fe04e3572d8a8f776a5fe7b0` | да |
| `feature/kol-payment-integrity-20260820` | `3b438b20d7ea321ea1c6f972f9380a81b7568943` | нет |
| `feature/kol-payment-integrity-v2-20260820` | `920f9bc95a5eb3b2cfbd724ce5cf726a1a93373d` | да |
| `feature/kol-product-experience-20261022` | `60cc18520b88dc8a52dd953d9fea5169bf2270e3` | нет |
| `feature/kol-public-booking-detail-read-v1-20260821` | `56178199f163c3f30f9d276bc310d24974cdc7b9` | нет |
| `feature/kol-real-booking-actions-v1-20260821` | `5614329365f11aa31bdf6d476610364778363fdf` | нет |
| `feature/kol-real-booking-ui-v1-20260821` | `71e2630bee7475926dbce2d218cd50e52dc12ad8` | нет |
| `feature/kol-real-booking-ui-v1-20260821-copy-check` | `61f8aed4a122c7141375f5c74858954af550b968` | нет |
| `feature/kol-release-readiness-v2-20260820` | `aef538042a6ab0ed466a9261ed6348db17d48453` | да |
| `feature/kol-staging-execution-package-v1-20260821` | `1cea0008c8fb108337aa0cfea7b7c5e238394054` | да |
| `feature/kol-staging-readiness-20260820` | `0931da71ebe6e6fe69976c87a9a2eddd5a8ce295` | нет |
| `feature/kol-unified-delivery-20261021` | `437f7032dc2cebf493da25f0670d178a9b83df91` | нет |
| `fix/align-local-storage-live` | `6a441ed69dda5cecbb0e35ad9086ef74b546c59a` | нет |
| `fix/audit-production-env-fail-closed` | `621c872e4b3d3d6172ea547bb131d5d57b9877a3` | нет |
| `fix/auth-core-import-cycle` | `2a069afff83062edb46ecee9643613a4c8612fa6` | нет |
| `fix/authenticated-booking-checkout-runtime` | `6120c2503ba3520431d845f79c259e0253789a79` | да |
| `fix/booking-reject-inventory-release` | `ca02e9e72559bad6ec5fdc77c56989d61ec2dd76` | нет |
| `fix/cabinet-read-identity-guards` | `a98b0a6b2d58a75f9988f14c205bc1557134b97d` | нет |
| `fix/deployment-env-selftest-unicode-path` | `cbd581297f107bb94787094f80816f0cbe55d7a4` | нет |
| `fix/home-visual-qa-2026-09-28` | `ce63a1a26f97889fc0b87166f725a33082532a75` | нет |
| `fix/ignore-typescript-buildinfo` | `89e3cf837ce8dc7d4dbaf0d2e1746e97dfff87c5` | да |
| `fix/kol-booking-idempotency-hardening-20261022` | `5dc0296596124732580ec4a9f2262bdc69fa3ba0` | нет |
| `fix/kol-ci-artifact-eslint-config-20260827` | `42cfa1dade34a9b9b4c6a902db904900ab48e31f` | нет |
| `fix/kol-eslint-flat-config-20260827` | `874841bbcef8026b18ffe3a0cbed1884ea1320d3` | да |
| `fix/kol-final-content-2026-09-28` | `c895d2f9b11e9029288194121297f2f98121088b` | нет |
| `fix/kol-hide-data-source-diagnostics-production-20260821` | `e2219c3ada48fbb38f8403fd108c45b53533265b` | нет |
| `fix/kol-production-data-source-guard-20260820` | `9ca61e47916b7c3b7f401d429cb27bd090c75a6b` | нет |
| `fix/kol-production-dependencies-20261021` | `2755a4f2249c9206c6c5f8a1b667e6bbcb237653` | нет |
| `fix/kol-rls-security-baseline-20260820` | `b62f5e8e092be2f4ce26afa1af567d3cb00212b2` | нет |
| `fix/kol-stage1-delivery-integrity-20261022` | `b7a898fa130376ea2f578725d91083d8a6f6ce44` | нет |
| `fix/kol-tailwind4-security-20261021` | `3af77f8e6b61c6d479bab73818005eda8b2413b3` | нет |
| `fix/partner-replay-requires-audit` | `1f91b4a054e0007759719f211ee8705d3fcb94af` | нет |
| `fix/public-demo-access-2026-09-27` | `3b2dc71098758739c176c85f4b6bad608ab13c4e` | нет |
| `fix/restore-locale-order` | `db296e9086006b010db18b03950429b6aba5a7a1` | нет |
| `fix/restore-managed-supabase-roles` | `5ee01c2ecfbe18741476efc3a457ee320be5ea92` | нет |
| `fix/restore-supabase-admin-owner` | `1d06078ba3fd0cf252d768dac7253ecb07fb60f3` | нет |
| `fix/stay-price-presentation-2026-09-28` | `fce6d33d795317dfbf54259682d4115175580d87` | нет |
| `fix/ubuntu-password-only-connection` | `27765c59a387c0a294da5be2c845ded6ad0f5aa0` | да |
| `integration/kol-pre-live-gate1-rc-20260821` | `b5c0ffb6bb5f855dd388c4ada318d82e808b308f` | нет |
| `launch/production-gate-2026-09-25` | `4ad1c31c91a96bc8b9c78a64b5e56654d0c94e30` | нет |
| `launch/public-intake-2026-09-25` | `9047ff1bfb01383021359816333de86064af4b52` | нет |
| `main` | `0a04ba6659da9b5b9b830aa301ab1c7dc684c27e` | да |
| `ops/catalog-media-production-preaction` | `8a3711bf0b0e7f219c4bbdc0a868807f58c85301` | нет |
| `ops/free-live-backup-rehearsal` | `8e5dcb2fb834d85a135b16457d4bc831d4275050` | нет |
| `ops/kol-approved-design-ubuntu-20261022` | `82f13d2288348d8c7ff6ac64690c9e2329785784` | нет |
| `ops/kol-audited-preview-7735c16` | `f3d901cfb0c0a4746c9c595564a1c94e810f57ba` | нет |
| `ops/kol-current-design-ubuntu-20261022` | `d32044a14c96ae0be80631e787810233c69a90a6` | нет |
| `ops/kol-ubuntu-compose-20261021` | `edc0f3e20b099071fb8b0b09c75ac97ec86175a1` | нет |
| `ops/live-backup-rehearsal` | `8286a2d4e6cc7b841a8ce4d465ac3242a541a16b` | нет |
| `ops/mvp-safe-launch-20260924` | `190eb879f95a77ff9e40a09f5686323127f79bf2` | нет |
| `ops/run-live-backup-rehearsal` | `258dbfb8115d1db7a1c5e3e4ab9f8d7e13d0d5fa` | нет |
| `ops/ubuntu-oneclick-backup-restore` | `768c5affeead035469dcd1fd685907e2e570c9c8` | да |
| `perf/kol-fk-index-baseline-20260820` | `05129c2bbf5667b0c1a4b7c22d3dd5062a14cab9` | нет |
| `perf/kol-fk-index-baseline-v2-20260820` | `8470ac719313d395dddd071f2d1d8d4258d9ee5e` | да |
| `release/kol-approved-ui-rc1-20261022` | `da871850ec539a6ad7dc0618c8474d045ec3ab75` | нет |
| `security/kol-booking-temporal-hardening-20260821` | `489b6e523043e9c8664dc8f349f5b0e1cb6224e0` | нет |
| `security/kol-next-15-5-21-20260820` | `b589eae887f718700d587edd6d65d075c19e16a1` | нет |
| `security/kol-rls-baseline-v2-20260820` | `76b765329ff96d29a71a7f93bb63ae649d4ddfae` | да |
| `temp-check-ignore` | `61f8aed4a122c7141375f5c74858954af550b968` | нет |
| `test/kol-live-baseline-readonly-evidence-20260821` | `92dba36b326048c4d3bd89fe6d7c1352960160b0` | нет |
| `test/kol-local-supabase-staging-smoke-20260821` | `f49fa1b2a3159a1c916cc671787974a6dd01486d` | да |
| `test/kol-local-transaction-behavior-20260821` | `e8830ad388b5db76efd4e9e3c62820cbd39c4c65` | нет |
| `test/local-supabase-auth-session-runtime` | `8faf03078ecb30fef10fc8a2c55dc73f0257e093` | да |
| `test/operational-role-e2e` | `c8f34060055aacb38b43690d7fb353d755d68820` | да |
| `test/supabase-public-booking-detail-runtime` | `0ef3242a707fc596c6fb287fce1a00f65be62c74` | да |
| `test/supabase-public-runtime-smoke` | `2524098a7262bba26ca055ffbebf0c2c575c0c79` | да |
| `tmp-finalization-anchor` | `61f8aed4a122c7141375f5c74858954af550b968` | нет |
