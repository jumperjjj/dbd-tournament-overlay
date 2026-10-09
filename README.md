# DBD Tournament Overlay v2.0.0

Aplicativo Windows em Tauri para controlar campeonatos de Dead by Daylight. O painel **DBD Tournament Control** também funciona como dock do OBS.

## Usar no OBS

Baixe o instalador em [Releases](https://github.com/jumperjjj/dbd-tournament-overlay/releases), instale e mantenha o programa aberto.

| Uso | Endereço |
| --- | --- |
| Dock de navegador | `http://127.0.0.1:8765/panel.html` |
| Fonte de Navegador | `http://127.0.0.1:8765/overlay.html` |

Configure a Fonte de Navegador em **1920 × 1080**. O servidor funciona somente neste computador. Fechar a janela recolhe para a bandeja; **Sair e encerrar overlay** encerra o servidor.

## Recursos

- Oito estilos: Studio, Air, Frame e Ribbon com placar numérico; Shards, Rails, Orbit e Split com vitórias marcadas.
- MD3/MD5, nomes dos times, campeonato, set e placar editáveis.
- Contadores de geradores (0–5), ganchos (0–12) e First Hook (0–4).
- Seleção do time de Killer, ícones permanentes de Killer/Survivors.
- Atualização ao vivo e configurações salvas automaticamente.
- Vitórias brancas, textos brancos e cores de destaque opcionais.
- Degradê, opacidade, escala da overlay completa e reset individual de cores.
- Confirmação nos resets do placar e dos contadores.
- Posição vertical por arraste, recolhida abaixo dos endereços do OBS. Ajuste de 6 a 100 px do topo, posição original em 78 px. Setas do teclado fazem ajustes finos.

A escala no painel vai de 50 a 100, equivalente a 90%–110% do tamanho base. Não existem ajustes de tamanho por elemento.

## Atualizar da versão Electron

Encerre e desinstale a versão Electron antes de instalar a v2.0.0. O novo instalador não remove automaticamente a v1.x; apenas um servidor pode usar a porta 8765. Presets, fontes e ajustes individuais da v1.x não são importados automaticamente. A nova configuração é feita pelo painel.

## Desenvolvimento

Para testar só a interface e o servidor de prévia:

```powershell
npm ci
npm test
npm run preview
```

A prévia usa Node e guarda o estado em `.preview-state/`. O aplicativo final usa o servidor Rust embutido e o diretório de dados do aplicativo.

Para compilar no Windows, instale [os pré-requisitos do Tauri](https://v2.tauri.app/start/prerequisites/) (Rust, MSVC/Windows SDK e WebView2):

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
npm run dev
npm run dist
node scripts/smoke-native.cjs
```

O instalador fica em `src-tauri/target/release/bundle/nsis/`. O smoke test deve ser executado sem outro servidor na porta 8765 e usa as configurações do aplicativo daquele usuário: prefira uma máquina de teste ou o GitHub Actions.

## Release

O workflow Windows compila, executa testes JavaScript/Rust e testa o executável nativo, incluindo reinício e persistência. Na execução manual, habilitar **Publicar release v2.0.0 após os testes** publica o instalador e seu SHA-256 somente se todas as verificações passarem.

A interface foi conferida no navegador. Não houve teste de transmissão no OBS nem comparação de consumo de RAM/CPU.
