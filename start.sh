#!/bin/sh

envsubst '${API_GATEWAY_URL}' < /etc/nginx/nginx.template.conf > /etc/nginx/nginx.conf

nginx -g 'daemon off;'
