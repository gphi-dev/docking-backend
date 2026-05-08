# Rewards API Postman Requests

Use the backend base URL as `{{base_url}}` and an admin JWT as `{{admin_token}}`.
The `game_id` field is the value from `games.game_id`, not `games.id`.

Headers for all requests:

```text
Content-Type: application/json
Authorization: Bearer {{admin_token}}
```

## 1. Create Reward

```text
POST {{base_url}}/api/rewards
```

```json
{
  "game_id": 1,
  "picture": "https://example.com/image.jpg",
  "description": "Free coins reward",
  "prize": "100 Coins",
  "holdings": 50,
  "is_active": 1
}
```

## 2. Get All Rewards

```text
GET {{base_url}}/api/rewards?page=1&limit=10
```

## 3. Get Rewards By Game ID

```text
GET {{base_url}}/api/rewards?game_id=1&is_active=1&page=1&limit=10
```

## 4. Get Reward By ID

```text
GET {{base_url}}/api/rewards/1
```

## 5. Update Reward

```text
PUT {{base_url}}/api/rewards/1
```

```json
{
  "game_id": 1,
  "picture": "https://example.com/updated-image.jpg",
  "description": "Updated reward description",
  "prize": "500 Coins",
  "holdings": 100,
  "is_active": 1
}
```

## 6. Deactivate Reward

```text
PATCH {{base_url}}/api/rewards/1/status
```

```json
{
  "is_active": 0
}
```

## 7. Delete Reward

```text
DELETE {{base_url}}/api/rewards/1
```
