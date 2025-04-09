# Imagem base do Node.js
FROM node:18

# Diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependências e código
COPY package*.json ./
COPY static/ ./static/
COPY index.js ./
COPY anexo.json ./

# Instala as dependências
RUN npm install --registry=https://registry.npmmirror.com


# Porta que será exposta
EXPOSE 8000

# Variável de ambiente de conexão com o MySQL
ENV POSTGIS_CONNECTION_STRING="mysql://diego:minhasenha@db:3306/ibge"

# Comando padrão
CMD ["npm", "start"]
