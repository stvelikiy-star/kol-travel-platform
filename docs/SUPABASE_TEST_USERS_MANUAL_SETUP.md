# Supabase Test Users Manual Setup

Этот документ описывает ручное создание test users в Supabase TEST project. Не создавайте пользователей автоматически и не храните реальные пароли в репозитории.

## Test Users

Создайте вручную в Supabase Authentication -> Users:

- `client@test.kol`
- `partner@test.kol`
- `courier@test.kol`
- `admin@test.kol`
- `superadmin@test.kol`

Правила:

- используйте только fake test emails;
- используйте fake test passwords;
- не записывайте пароли в docs;
- не коммитьте credentials;
- если доступно, включите Auto Confirm для тестовых пользователей;
- используйте только Supabase TEST project.

## Profile Mapping Plan

После создания пользователей проверьте реальные поля profiles table и заполните profile mappings вручную.

`client@test.kol`:

- role `client`
- status `active`

`partner@test.kol`:

- role `partner`
- status `active`
- `partner_id` из таблицы `partners`

`courier@test.kol`:

- role `courier`
- status `active`
- `courier_id` из таблицы `couriers`

`admin@test.kol`:

- role `admin`
- status `active`

`superadmin@test.kol`:

- role `super_admin`
- status `active`

## Before First Real Write

Перед `markOrderReadyForPickupAction` убедитесь:

- `partner@test.kol` может войти;
- profile возвращает `partner_id`;
- test order имеет такой же `partner_id`;
- order status: `accepted_by_partner` или `preparing`;
- partner не может менять `payment_status`;
- partner не может менять заказ другого партнёра;
- audit strategy проверена.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Test users не могут включать alcohol module.
- Любая alcohol-related request считается critical risk.
