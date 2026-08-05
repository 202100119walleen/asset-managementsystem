-- ====================================================================
-- ASSET MANAGEMENT SYSTEM - DATABASE SCHEMA (PostgreSQL / Supabase)
-- ====================================================================

-- 1. STORES TABLE
CREATE TABLE IF NOT EXISTS public.stores (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ASSETS TABLE
CREATE TABLE IF NOT EXISTS public.assets (
    id VARCHAR(50) PRIMARY KEY,
    store_code VARCHAR(50) REFERENCES public.stores(code) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    serial VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Good',
    location VARCHAR(255),
    last_maintenance DATE,
    due_date DATE,
    value NUMERIC(12, 2) DEFAULT 0,
    image_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. MAINTENANCE LOGS & COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
    id VARCHAR(50) PRIMARY KEY,
    asset_id VARCHAR(50) REFERENCES public.assets(id) ON DELETE CASCADE,
    store_code VARCHAR(50) REFERENCES public.stores(code) ON DELETE CASCADE,
    date DATE NOT NULL,
    technician VARCHAR(255) NOT NULL,
    status_before VARCHAR(50),
    status_after VARCHAR(50) NOT NULL,
    cost NUMERIC(12, 2) DEFAULT 0,
    image_url TEXT,
    notes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. REAL-TIME NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id VARCHAR(50) PRIMARY KEY,
    recipient_role VARCHAR(20) NOT NULL, -- 'admin' or 'store'
    recipient_store_code VARCHAR(50),    -- null for all admins or specific store code
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    asset_id VARCHAR(50),
    store_code VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    type VARCHAR(50) DEFAULT 'info',    -- 'log', 'reply', 'status', 'assignment'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES FOR FAST RECIPIENT & STORE QUERYING
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS due_date DATE;
CREATE INDEX IF NOT EXISTS idx_assets_store_code ON public.assets(store_code);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_asset_id ON public.maintenance_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_role, recipient_store_code, is_read);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow anonymous & authenticated access for application operational sync
CREATE POLICY "Allow public read/write access to stores" ON public.stores FOR ALL USING (true);
CREATE POLICY "Allow public read/write access to assets" ON public.assets FOR ALL USING (true);
CREATE POLICY "Allow public read/write access to maintenance_logs" ON public.maintenance_logs FOR ALL USING (true);
CREATE POLICY "Allow public read/write access to notifications" ON public.notifications FOR ALL USING (true);

-- SAFE IDEMPOTENT SUPABASE REALTIME PUBLICATION SETUP
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'maintenance_logs'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_logs;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'assets'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
        END IF;
    END IF;
END $$;
