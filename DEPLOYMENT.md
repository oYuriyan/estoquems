# Lummium - Guia de Implantação (Deployment)

Este guia cobre a instalação e execução do sistema Lummium em uma **Máquina Virtual (VM) com Ubuntu/Linux** focada em uso por **IP Interno** (rede corporativa).

---

## Passo 1: Acessar a Máquina Virtual (VM) via SSH

Abra o Terminal (ou PowerShell) no seu Notebook e conecte-se à VM utilizando o IP que o outro técnico forneceu.
```bash
ssh usuario_da_vm@<IP_DA_VM>
```
*Dica: Caso você tenha recebido uma chave `.pem`, o comando será: `ssh -i chave.pem usuario@<IP_DA_VM>`*

---

## Passo 2: Instalar Dependências (Docker e Git)

Uma vez logado na máquina preta do servidor, atualize os pacotes e instale o essencial:

```bash
# Atualizar a lista de pacotes
sudo apt update && sudo apt upgrade -y

# Instalar Git e Curl
sudo apt install git curl -y

# Instalar o Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Dar permissão para o seu usuário rodar o Docker sem precisar de "sudo" toda hora
sudo usermod -aG docker $USER
```
*(Importante: Saia da VM digitando `exit` e entre novamente pelo Passo 1 para a permissão do Docker fazer efeito).*

---

## Passo 3: Clonar o Repositório e Configurar

Baixe o código do projeto diretamente do seu GitHub para a VM:

```bash
# Clone o repositório
git clone https://github.com/oYuriyan/estoquems.git

# Entre na pasta
cd estoquems

# Copie o arquivo de variáveis de ambiente
cp .env.example .env

# Edite o arquivo de variáveis de ambiente
nano .env
```

**O que editar no `.env`:**
1. Mude a senha do PostgreSQL (`POSTGRES_PASSWORD`).
2. Adicione uma string aleatória forte no `JWT_SECRET_KEY`.
3. Defina a origem do frontend para o IP interno (ex: `FRONTEND_ORIGIN=http://192.168.0.50`).
4. Salve e saia do editor Nano: Pressione `CTRL + X`, depois `Y` e `ENTER`.

---

## Passo 4: Subir o Sistema

Com tudo configurado, inicie os containeres utilizando a configuração de Produção:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Isso vai compilar o Backend e subir o Nginx, PostgreSQL e o n8n. Após alguns minutos, você poderá acessar o sistema no navegador de qualquer computador na rede digitando apenas o IP da máquina (ex: `https://<IP_DA_VM>`).

> **Nota sobre o Certificado de Segurança:** Como não estamos usando um domínio público (`.com.br`), o Nginx utilizará o Certificado Autoassinado que já está na pasta do projeto. O navegador ainda dará o aviso de "Conexão Não Segura", mas você pode clicar em *Avançado > Ir para o site*. Os dados trafegados **estarão criptografados** com segurança!

---

## Passo 5: Acesso Administrativo ao n8n (Túnel SSH)

Por segurança, **a porta 5678 do n8n não está exposta para a rede da empresa**. Ninguém conseguirá acessar os fluxos de integração pelo IP. 

Quando **você** (administrador) precisar criar ou editar um fluxo do n8n na máquina de produção, você deve criar um **Túnel SSH** no seu Notebook. 

**Como fazer:**
Abra o PowerShell do seu Notebook (sem estar conectado na VM) e digite:
```bash
ssh -L 5678:localhost:5678 usuario_da_vm@<IP_DA_VM>
```

**O que isso faz?**
Ele cria um "túnel" seguro criptografado. A porta 5678 do seu computador agora está conectada diretamente na porta 5678 da VM por dentro do SSH.

**Para acessar:**
Basta abrir o navegador do seu notebook e acessar:
👉 `http://localhost:5678`

Você verá o painel do n8n de produção. Ao fechar a tela preta do PowerShell do seu notebook, o túnel é destruído e o n8n volta a ficar inacessível e invisível para todos.
