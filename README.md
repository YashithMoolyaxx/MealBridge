# MealBridge

MealBridge is a startup-grade food redistribution platform connecting donors, volunteers, and NGO receivers through an auditable mission lifecycle.

## Monorepo

- `backend/` Django + DRF + PostgreSQL (Supabase-ready)
- `frontend/` React + Vite + Tailwind
- `docs/` architecture, schema, lifecycle, and implementation plan

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Architecture Deliverable

See `docs/MEALBRIDGE_ARCHITECTURE.md` for:

- full folder structure
- Django models and schema
- REST API map
- React component architecture
- DB ER diagram
- mission lifecycle diagram
- scale-up implementation roadmap