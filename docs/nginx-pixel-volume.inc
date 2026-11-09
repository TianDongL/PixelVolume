# Include in the existing HTTPS server block. Web root: /var/www/html.
location = /pixel-volume { return 301 /pixel-volume/; }
location ^~ /pixel-volume/ {
    root /var/www/html;
    index index.html;
    try_files $uri $uri/ =404;
    autoindex off;
    add_header Cache-Control "no-store" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    limit_except GET HEAD { deny all; }
    location /pixel-volume/releases/ {
        try_files $uri =404;
        default_type application/octet-stream;
        add_header Content-Disposition "attachment" always;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
}
