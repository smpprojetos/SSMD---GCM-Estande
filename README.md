# Estande GCM Ribeirão Pires — Modelo 02

Visualizador 3D independente, com o modelo GLB, logos, materiais e bibliotecas incluídos. Não exige instalação nem compilação.

## Publicar pelo site do GitHub

1. Extraia este ZIP no computador.
2. Crie ou abra um repositório no GitHub. Para usar GitHub Pages no plano gratuito, use um repositório público.
3. Em Add file > Upload files, envie o conteúdo extraído, mantendo as pastas assets e vendor. O arquivo index.html deve ficar na raiz do repositório. Não envie apenas o ZIP.
4. Confirme em Commit changes.
5. Em Settings > Pages, selecione Source: Deploy from a branch.
6. Selecione a branch main, a pasta / (root) e clique em Save.
7. Aguarde a publicação. O endereço definitivo aparecerá nessa mesma página em Visit site.

Mantenha também o arquivo .nojekyll incluído no pacote para dispensar o processamento Jekyll.
O GitHub pode levar até 10 minutos para publicar.

Documentação oficial:
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Controles

- Arrastar: olhar ao redor.
- WASD ou setas: caminhar.
- E ou botão Abrir porta entre salas: abrir/fechar a porta de ligação.
- Tiro real, Estande digital e Vista geral: selecionar ponto de vista.
- Laje e teto, Iluminação e Identificar sistemas: opções de visualização.
- Em telas sensíveis ao toque, use as setas da interface.

## Arquivos

index.html, style.css e app.js formam o visualizador.
assets/ contém o novo modelo estande-v2.glb e os logos.
optimize.js agrupa as superfícies estáticas sem simplificar suas faces.
vendor/ contém as bibliotecas Three.js e a respectiva licença.
Os caminhos são relativos, compatíveis com GitHub Pages em subpastas de repositórios.
Não é necessário alterar os arquivos para informar seu nome de usuário do GitHub.

## Abrir localmente no Windows

1. Extraia o ZIP inteiro para uma pasta do computador.
2. Com Python 3.7 ou superior instalado, dê dois cliques em INICIAR-WINDOWS.bat.
3. O navegador abrirá o estande. Mantenha a janela do terminal aberta durante o uso.
4. Para encerrar, pressione Ctrl+C no terminal.

O inicializador escolhe uma porta livre automaticamente e atende apenas o próprio computador. O modelo e as bibliotecas estão incluídos; não precisa de internet durante a visita.
Se o navegador não abrir sozinho, copie o endereço mostrado no terminal.
Abrir index.html diretamente com duplo clique pode impedir o carregamento do modelo.

No macOS ou Linux, com Python 3 instalado, execute na pasta extraída:

    python3 iniciar.py

Para GitHub Pages, envie o conteúdo do pacote com index.html na raiz, seguindo os passos acima. Os arquivos .bat e .py são auxiliares para uso local e não são necessários no GitHub Pages.

## Atualizações do modelo 02

- Novo GLB fornecido pelo usuário, com os grafismos e acabamentos preservados.
- Porta de ligação animada por botão e tecla E.
- Colisões ajustadas à nova posição das baias.
- Superfícies estáticas agrupadas e sombras reaproveitadas para reduzir o trabalho de renderização.
- Materiais de espuma, borracha e metal, com iluminação e sombras.

## Observações

Esta exportação não publica automaticamente no GitHub e não inclui controle de acesso.
No GitHub Pages, a visualização normalmente fica acessível publicamente.
Estudo arquitetônico conceitual, sem certificação de conformidade técnica ou balística.
A licença Three.js se aplica à biblioteca; este pacote não concede direitos adicionais sobre os logos e o modelo fornecidos.
