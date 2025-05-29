# 📘 Documentação 

Esta API é desenvolvida em Node.js e suporta dados geográficos utilizando GeoJSON e MySQL, com funcionalidades de busca por endereço, geolocalização e rotas. A API emprega Docker e Turf.js para realizar análises espaciais avançadas.

---

## 🚀 Guia de Início com Docker Compose

### Estrutura Esperada do Projeto:

```
inova_maps/
├── index.js
├── anexo.json
├── package.json
├── dockerfile
├── docker-compose.yml
└── static/
```

### Comandos Principais:

```bash
# Construir a imagem
docker-compose build

# Iniciar os serviços (API + MySQL)
docker-compose up

# Parar todos os serviços
docker-compose down

# Forçar a reconstrução e iniciar
docker-compose up --build
```

📎 **Nota:** Assegure-se de que o arquivo `anexo.json` contém dados GeoJSON válidos.

### 🌐 Endpoints Disponíveis

| Nome                | Descrição                                                                 | Método | Exemplo Completo                                      |
|---------------------|---------------------------------------------------------------------------|--------|-------------------------------------------------------|
| `/search`           | Busca por nome de logradouro                                              | GET    | `/search?term=BRASILIA&limit=10&order=ASC`            |
| `/reverse_full`     | Retorna o endereço mais próximo com base em coordenadas                   | GET    | `/reverse_full?lat=-15.793889&lon=-47.882778`         |
| `/nearby_faces`     | Lista os logradouros mais próximos dentro de um raio                      | GET    | `/nearby_faces?lat=-15.79&lon=-47.88&radius=0.2`      |
| `/interpolate_number` | Ponto ao longo de uma linha baseado em um ID e distância                | GET    | `/interpolate_number?id=003&distance=0.1`             |
| `/geojson`          | Retorna todos os dados convertidos para GeoJSON                           | GET    | `/geojson`                                            |
| `/distance`         | Calcula a distância entre duas coordenadas                               | GET    | `/distance?lat1=-15.79&lon1=-47.88&lat2=-15.80&lon2=-47.89` |
| `/route`            | Fornece uma rota entre dois pontos                                        | GET    | `/route?lat1=-15.79&lon1=-47.88&lat2=-15.80&lon2=-47.89`  |
| `/normalize_address`| Normaliza o endereço removendo acentos e caracteres especiais             | GET    | `/normalize_address?text=Rua+do+Sol`                 |
| `/suggest`          | Sugere logradouro mais próximo com base em coordenadas                    | GET    | `/suggest?lat=-15.79&lon=-47.88`                      |

### 🧪 Exemplos de Uso com `curl`

```bash
# Procurar logradouros pelo nome
curl "http://localhost:8000/search?term=BRASILIA&limit=5"

# Obter o endereço mais próximo a partir de coordenadas
curl "http://localhost:8000/reverse_full?lat=-15.793889&lon=-47.882778"

# Listar os logradouros mais próximos dentro de um raio
curl "http://localhost:8000/nearby_faces?lat=-15.7938&lon=-47.8832&radius=0.2"

# Identificar um ponto ao longo de uma linha (CD_FACE = 003)
curl "http://localhost:8000/interpolate_number?id=003&distance=0.3"

# Calcular a distância entre duas coordenadas
curl "http://localhost:8000/distance?lat1=-15.7938&lon1=-47.8832&lat2=-15.7948&lon2=-47.8822"

# Fornecer uma rota entre dois pontos
curl "http://localhost:8000/route?lat1=-15.7938&lon1=-47.8832&lat2=-15.7948&lon2=-47.8822"

# Normalizar endereço removendo acentos
curl "http://localhost:8000/normalize_address?text=Avenida+Brasil"

# Obter resultado completo com a sugestão mais próxima
curl "http://localhost:8000/suggest?lat=-15.7938&lon=-47.8832"
```

### 📦 Tecnologias Empregadas

- Node.js + Express
- MySQL 8
- Docker / Docker Compose
- Turf.js (para geoprocessamento)
- normalize-text (para normalização de buscas)

### ✨ Melhorias Futuras

- Implementar filtros geográficos por raio
- Integração com mapas utilizando Leaflet.js
- Suporte para armazenamento incremental e reimportação de dados
- Interface para upload de novos arquivos GeoJSON
