# MedBrain MVP (React + Node.js + Supabase)

Diagram asosida qurilgan birinchi ishchi versiya:
- Frontend: React (Vite)
- Backend: Node.js + Express
- DB: Supabase (PostgreSQL)

## Nimalar ishlaydi

### Student oqimi
- Login
- Faculty -> Direction -> Topic tanlash
- Published testlar ro‘yxati
- Testni boshlash
- Savollarga birma-bir javob berish
- Taymer tugasa auto-submit
- Natija sahifasi (score, to‘g‘ri/noto‘g‘ri, har savol bo‘yicha tahlil)

### Admin oqimi
- Login
- Faculty CRUD
- Direction CRUD
- Topic CRUD
- Test yaratish (savollar + time limit + publish)
- Test publish/unpublish va delete
- Statistikalar va so‘nggi attemptlar

## Papkalar

- `frontend` - React ilova
- `backend` - Express API
- `backend/supabase/schema.sql` - to‘liq schema + seed

## Ishga tushirish

1. Supabase loyihangizda SQL Editor oching va `backend/supabase/schema.sql` ni ishga tushiring.
2. `backend/.env.example` dan `backend/.env` yarating va qiymatlarni to‘ldiring.
3. `frontend/.env.example` dan `frontend/.env` yarating.
4. Terminal 1:

```bash
cd backend
npm install
npm run dev
```

5. Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

## Demo login

- Admin: `admin / admin123`
- Student: `student1 / student123`

## Diagram bilan moslik

- `Login valid?` -> `/api/auth/login`
- `Load available tests` -> `/api/student/catalog`
- `Start timer` -> frontend countdown + backend time check
- `Submit for checking` -> `/api/student/attempts/:id/submit`
- `Calculate score` -> backend `evaluateAttempt`
- `Persist results` -> `attempts` va `attempt_answers` jadvallari
- Admindagi barcha boshqaruvlar -> `/api/admin/*`

## Keyingi bosqichlar

- Supabase Auth ga o‘tish
- RLS policy qo‘shish
- Test va statistika uchun filter/pagination
- DB’ni boshqa providergà ko‘chirish uchun repository qatlamini ajratish