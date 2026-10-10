A v2.0.1 mantém o aplicativo Tauri com servidor Rust e acrescenta distribuição portátil e endereço local separado.

- Nova porta local **8766**, sem conflitar com a porta 8765 da versão anterior.
- Instalador: **DBD-Tournament-Overlay-Setup-2.0.1.exe**.
- Portátil: **DBD-Tournament-Overlay-Portable-2.0.1.exe**. Abra diretamente, sem instalar. As configurações continuam salvas no diretório de dados do usuário, e o WebView2 precisa estar disponível no Windows.
- SHA256SUMS.txt contém os hashes dos dois executáveis.

**OBS:** atualize o dock para http://127.0.0.1:8766/panel.html e a Fonte de Navegador para http://127.0.0.1:8766/overlay.html (1920 × 1080). O acesso continua restrito ao próprio computador.

**Atualização:** encerre o aplicativo antigo pela bandeja antes de instalar ou abrir a nova versão. Instalador e portátil usam a mesma configuração e devem ser usados um de cada vez. A versão portátil não precisa que Tauri, Rust ou Node.js sejam instalados.

**Controle Inteligente de Aplicativos do Windows:** esta distribuição ainda não possui assinatura digital de fornecedor confiável. O Windows pode bloquear tanto o instalador quanto o portátil. O portátil e a mudança de porta não corrigem esse bloqueio. A solução de distribuição depende de assinatura de código reconhecida pelo Windows; não foi adicionada uma assinatura autoassinada nem alterada a segurança do sistema.

Referência: https://learn.microsoft.com/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control

A publicação exige testes JavaScript/Rust, compilação e teste do executável nativo com sincronização e persistência.
