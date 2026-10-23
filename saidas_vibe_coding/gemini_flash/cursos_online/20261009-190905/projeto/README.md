# Plataforma de Cursos Online com Matrícula

Uma plataforma web completa, moderna e pronta para uso. Funciona tanto para alunos quanto para o administrador, sincronizando em tempo real com o servidor e salvando tudo de forma persistente.

---

## 🚀 Como Instalar e Rodar (Passo a Passo)

Você só precisa ter o **Node.js** instalado no seu computador ([baixar Node.js se não tiver](https://nodejs.org/)).

### 1. Abrir a pasta do projeto no Terminal ou Prompt de Comando
Abra o terminal na pasta onde descompactou os arquivos do projeto.

### 2. Instalar as dependências necessárias
Execute o seguinte comando e aperte **Enter**:
```bash
npm install
```

### 3. Iniciar o site
Execute o comando:
```bash
npm start
```

### 4. Acessar a plataforma
Abra o seu navegador de internet (Google Chrome, Edge, Safari, Firefox) e acesse:
👉 **http://localhost:3000**

---

## 👥 Contas Prontas para Uso

O sistema já vem configurado com as seguintes contas pré-cadastradas:

### 👑 Administrador da Plataforma:
- **E-mail:** `admin@cursos.com`
- **Senha:** `admin123`
*(O administrador tem acesso ao Painel Admin para criar, editar, excluir cursos, ver todas as matrículas de todos os alunos e cancelar qualquer matrícula).*

### 🎓 Aluno de Teste:
- **E-mail:** `aluno@cursos.com`
- **Senha:** `aluno123`
*(Você também pode clicar no botão **"Criar Conta"** na barra superior e cadastrar quantos novos alunos quiser com qualquer e-mail e senha).*

---

## 📱 Recursos e Funcionamento

1. **Persistência Total:** Todas as informações (cursos criados, edições, alunos cadastrados e matrículas) ficam salvas em arquivo no próprio servidor (`data/database.json`). Mesmo se você reiniciar o computador ou fechar o navegador, nada se perde.
2. **Multi-dispositivo:** Se você acessar o endereço da máquina pelo celular (usando o IP do seu computador na rede local, por exemplo: `http://192.168.x.x:3000`), todas as ações feitas no celular aparecem imediatamente para quem está no computador.
3. **Catálogo de Cursos:** Alunos podem visualizar a carga horária, instrutor, categoria, número de matriculados e se matricular com 1 clique.
4. **Meus Cursos & Sala de Aula:** Alunos matriculados visualizam seus cursos e acessam a área com o conteúdo e material didático.
5. **Painel do Administrador:**
   - Cadastrar novos cursos com título, categoria, duração, instrutor, resumo e conteúdo.
   - Editar qualquer informação de um curso existente.
   - Excluir cursos da plataforma.
   - Visualizar a lista completa de todas as matrículas com nome do aluno, e-mail, data e status.
   - Cancelar matrículas ativas.
6. **Autenticação Segura:** Senhas criptografadas com `bcryptjs` e sessões protegidas por Cookies HTTP-only com `JWT`.
7. **Zero Serviços Externos:** Não depende de nenhum serviço pago, nuvem externa ou banco de dados externo. Tudo funciona 100% de forma autônoma.
