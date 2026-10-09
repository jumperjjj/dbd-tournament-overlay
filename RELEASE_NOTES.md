A v2.0.0 reformula o DBD Tournament Overlay e muda a tecnologia do aplicativo: de Electron/JavaScript para Tauri, com servidor local em Rust. O painel e a overlay continuam em HTML, CSS e JavaScript.

- Painel compacto em uma página, com o nome **DBD Tournament Control**.
- Oito estilos: quatro com placar numérico e quatro com marcações de vitórias.
- MD3/MD5, seleção direta do set e marcações brancas fora dos cards.
- Nomes, cores, escala, opacidade e posição atualizados em tempo real.
- Contadores de geradores, ganchos e First Hook com ícones e controles +/−.
- Ícones permanentes de Killer/Survivors e alternância de time.
- Destaque por time e degradê opcionais, com glow nos ícones e números.
- Botões separados e com confirmação para zerar placar e contadores.
- Reset individual de cores e posição vertical por arraste.
- Servidor Rust local, bandeja do sistema e configurações salvas automaticamente.

**Instalação:** baixe `DBD-Tournament-Overlay-Setup-2.0.0.exe`. O instalador usa WebView2; não é necessário instalar Node.js. O arquivo `SHA256SUMS.txt` permite conferir o download.

**Atualização da v1.x:** encerre e desinstale a v1.1.0 antes de instalar a v2.0.0. O novo instalador não remove automaticamente o aplicativo Electron. A configuração foi simplificada e não importa automaticamente presets, fontes ou ajustes individuais da versão Electron. Configure a nova versão pelo painel.

**OBS:** os endereços continuam os mesmos:
- Dock: `http://127.0.0.1:8765/panel.html`
- Fonte de Navegador: `http://127.0.0.1:8765/overlay.html`, em 1920 × 1080.

O servidor aceita conexões apenas do próprio computador. Mantenha o aplicativo aberto; fechar a janela recolhe para a bandeja. Para encerrar o servidor, use **Sair e encerrar overlay** na bandeja.

A publicação só acontece após testes JavaScript, testes Rust, compilação do instalador e teste do executável nativo, incluindo sincronização e persistência. A interface foi conferida no navegador; ainda não houve teste de transmissão dentro do OBS nem medição comparativa de RAM/CPU.
