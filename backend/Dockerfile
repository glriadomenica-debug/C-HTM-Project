
FROM php:8.2-apache

# Install PHP dependencies required by Laravel and PostgreSQL/MySQL.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libzip-dev \
    libonig-dev \
    libicu-dev \
    unzip \
    git \
    && docker-php-ext-install \
    pdo_pgsql \
    pdo_mysql \
    mbstring \
    bcmath \
    zip \
    intl \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

# Install Composer.
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy the Laravel backend.
COPY . .

# Install production dependencies.
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --optimize-autoloader

# Configure Apache to serve Laravel's public directory.
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/html/public|' \
    /etc/apache2/sites-available/000-default.conf \
    && sed -i 's/AllowOverride None/AllowOverride All/' \
    /etc/apache2/apache2.conf \
    && mkdir -p storage/framework/cache \
       storage/framework/sessions \
       storage/framework/views \
       storage/logs \
       bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

# Render supplies PORT; use 10000 as the default.
CMD ["sh", "-c", "php artisan migrate --force && sed -i \"s/Listen 80/Listen ${PORT:-10000}/\" /etc/apache2/ports.conf && sed -i \"s/<VirtualHost \\*:80>/<VirtualHost *:${PORT:-10000}>/\" /etc/apache2/sites-available/000-default.conf && exec apache2-foreground"]
