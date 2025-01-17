FROM --platform=linux/amd64 node:18-alpine
# FROM --platform=linux/amd64 keymetrics/pm2:latest-alpine
WORKDIR /usr/src/app
# # Bundle APP files
COPY app app/
COPY app.js .
COPY prisma prisma/
#COPY yarn*.json ./
#COPY package*.json ./
COPY ecosystem.config.js .
COPY . .

# # Install app dependencies
# ENV NPM_CONFIG_LOGLEVEL warn
#RUN yarn install 

# # Expose the listening port of your app
# EXPOSE 4800

# # Show current folder structure in logs
# RUN ls -al -R

# RUN npx prisma generate
# CMD [ "pm2-runtime", "start", "ecosystem.config.js" ]

#FROM --platform=linux/amd64 node:18-alpine
# Create app directory
#WORKDIR /usr/src/app

#RUN mkdir /usr/src/uploads
#RUN touch /usr/src/app/uploads
#RUN mv /usr/src/app/uploads ../uploads/

# RUN apk add openssl

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev

RUN apk update

#RUN apk add git
#RUN apk add zip

#RUN git clone https://github.com/develsde/zis-api.git .


RUN npm install pm2 -g
RUN npm install
#COPY package*.json ./
#COPY ecosystem.config.js .

#COPY app app/
#COPY config config/
#COPY app.js .
#COPY prisma prisma/
#COPY .dockerignore .
#COPY Dockerfile .
#COPY uploads.zip .
#RUN unzip uploads.zip
#RUN rm -rf uploads.zip

#COPY . .
#RUN mv /usr/src/uploads /usr/src/app/uploads/
#RUN rm -rf /usr/src/uploads
#RUN ln -s /usr/src/uploads/ uploads
EXPOSE 4800

RUN npx prisma generate
CMD [ "pm2-runtime", "start", "ecosystem.config.js" ]