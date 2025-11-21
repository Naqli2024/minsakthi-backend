# Use Node.js LTS image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./
RUN npm install --production

# Copy service source code
COPY . .

# Expose port
EXPOSE 5001

# Start app
CMD ["node", "server.js"]