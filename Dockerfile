# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json .
RUN npm install --force
COPY . .
# EXPOSE 3000
RUN npm run build

# CMD ["node", "--max-old-space-size=2048", "node_modules/react-scripts/scripts/start.js"]
# Stage 2: Serve the React application with Nginx
FROM nginx:1.27.0-alpine

# RUN  apk add --no-cache nginx-mod-http-lua
# RUN apk update nginx*
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.template.conf /etc/nginx/nginx.template.conf
COPY start.sh /start.sh


RUN chmod +x /start.sh

EXPOSE 8080
CMD ["/start.sh"]
