-- 007_billing_system.sql
-- Billing, subscriptions, and payment management system

-- Subscription plans table
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    -- Pricing
    price_monthly_cents INTEGER NOT NULL,
    price_yearly_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Plan features and limits
    features JSONB DEFAULT '{}',
    limits JSONB DEFAULT '{}',
    
    -- Plan properties
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    trial_days INTEGER DEFAULT 0,
    
    -- Stripe integration
    stripe_product_id VARCHAR(255),
    stripe_price_monthly_id VARCHAR(255),
    stripe_price_yearly_id VARCHAR(255),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    
    -- Subscription details
    status subscription_status DEFAULT 'trialing',
    billing_cycle billing_cycle DEFAULT 'monthly',
    
    -- Period management
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    canceled_by UUID REFERENCES users(id),
    
    -- Pricing snapshot (for historical accuracy)
    price_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Usage-based billing
    usage_based_billing BOOLEAN DEFAULT FALSE,
    usage_limits JSONB DEFAULT '{}',
    overage_rates JSONB DEFAULT '{}',
    
    -- External service integration
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id) -- One active subscription per tenant
);

-- Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Invoice identification
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    
    -- Invoice details
    status invoice_status DEFAULT 'draft',
    
    -- Amounts in cents
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Billing period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Due dates and payment
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    voided_at TIMESTAMP WITH TIME ZONE,
    
    -- External links
    hosted_invoice_url TEXT,
    invoice_pdf_url TEXT,
    payment_intent_id VARCHAR(255),
    
    -- Stripe integration
    stripe_invoice_id VARCHAR(255) UNIQUE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Item details
    description TEXT NOT NULL,
    type VARCHAR(100) NOT NULL, -- subscription, usage, addon, discount, tax
    
    -- Quantity and pricing
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    
    -- Period (for subscription items)
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    
    -- Usage details (for usage-based items)
    usage_type VARCHAR(100), -- tokens, messages, storage, api_calls
    usage_quantity DECIMAL(10,2),
    unit_cost_cents INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment methods table
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Payment method details
    type VARCHAR(50) NOT NULL, -- card, bank_account, paypal
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Card details (encrypted/tokenized)
    brand VARCHAR(50),
    last4 VARCHAR(4),
    exp_month INTEGER,
    exp_year INTEGER,
    
    -- Bank account details
    bank_name VARCHAR(255),
    account_type VARCHAR(50), -- checking, savings
    
    -- External service data
    stripe_payment_method_id VARCHAR(255),
    
    -- Status
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment transactions table
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Transaction details
    type VARCHAR(50) NOT NULL, -- payment, refund, chargeback
    status VARCHAR(50) NOT NULL, -- pending, succeeded, failed, canceled
    
    -- Amounts
    amount_cents INTEGER NOT NULL,
    fee_cents INTEGER DEFAULT 0,
    net_amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- External references
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    external_transaction_id VARCHAR(255),
    
    -- Failure details
    failure_code VARCHAR(100),
    failure_message TEXT,
    
    -- Processing timestamps
    processed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing addresses table
CREATE TABLE billing_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Company details
    company_name VARCHAR(255),
    tax_id VARCHAR(100),
    
    -- Address
    line1 VARCHAR(500) NOT NULL,
    line2 VARCHAR(500),
    city VARCHAR(255) NOT NULL,
    state VARCHAR(255),
    postal_code VARCHAR(50),
    country VARCHAR(2) NOT NULL, -- ISO country code
    
    -- Contact
    phone VARCHAR(50),
    email VARCHAR(255),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage-based billing records
CREATE TABLE billing_usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    
    -- Usage details
    usage_type VARCHAR(100) NOT NULL, -- tokens, messages, storage, api_calls
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost_cents INTEGER NOT NULL,
    total_cost_cents INTEGER NOT NULL,
    
    -- Time period
    usage_date DATE NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    resource_id UUID, -- Reference to conversation, tool execution, etc.
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent double billing
    UNIQUE(tenant_id, usage_type, usage_date, resource_id)
);

-- Discount codes and promotions
CREATE TABLE discount_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Discount details
    type VARCHAR(50) NOT NULL, -- percentage, fixed_amount, free_trial
    value INTEGER NOT NULL, -- Percentage (1-100) or amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Validity
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    
    -- Restrictions
    min_amount_cents INTEGER,
    applicable_plans UUID[], -- Array of plan IDs
    new_customers_only BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applied discounts
CREATE TABLE applied_discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Discount details
    discount_amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(discount_code_id, tenant_id)
);

-- Create indexes for performance
CREATE INDEX idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_subscription_plans_featured ON subscription_plans(is_featured) WHERE is_featured = TRUE;

CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_issued_at ON invoices(issued_at DESC);
CREATE INDEX idx_invoices_stripe_id ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_type ON invoice_line_items(type);

CREATE INDEX idx_payment_methods_tenant_id ON payment_methods(tenant_id);
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(tenant_id, is_default) WHERE is_default = TRUE;
CREATE INDEX idx_payment_methods_active ON payment_methods(tenant_id, is_active) WHERE is_active = TRUE;

CREATE INDEX idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX idx_payment_transactions_payment_method_id ON payment_transactions(payment_method_id) WHERE payment_method_id IS NOT NULL;
CREATE INDEX idx_payment_transactions_tenant_id ON payment_transactions(tenant_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_type ON payment_transactions(type);
CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

CREATE INDEX idx_billing_addresses_tenant_id ON billing_addresses(tenant_id);
CREATE INDEX idx_billing_addresses_active ON billing_addresses(tenant_id, is_active) WHERE is_active = TRUE;

CREATE INDEX idx_billing_usage_records_tenant_id ON billing_usage_records(tenant_id);
CREATE INDEX idx_billing_usage_records_subscription_id ON billing_usage_records(subscription_id);
CREATE INDEX idx_billing_usage_records_usage_type ON billing_usage_records(usage_type);
CREATE INDEX idx_billing_usage_records_usage_date ON billing_usage_records(usage_date DESC);
CREATE INDEX idx_billing_usage_records_billing_period ON billing_usage_records(billing_period_start, billing_period_end);

CREATE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_discount_codes_expires ON discount_codes(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_applied_discounts_discount_code_id ON applied_discounts(discount_code_id);
CREATE INDEX idx_applied_discounts_tenant_id ON applied_discounts(tenant_id);
CREATE INDEX idx_applied_discounts_subscription_id ON applied_discounts(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX idx_applied_discounts_invoice_id ON applied_discounts(invoice_id) WHERE invoice_id IS NOT NULL;

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_discounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY subscription_tenant_isolation ON subscriptions FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY invoice_tenant_isolation ON invoices FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY payment_method_tenant_isolation ON payment_methods FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

-- Create trigger to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION generate_invoice_number();

-- Create trigger to ensure only one default payment method per tenant
CREATE OR REPLACE FUNCTION enforce_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE payment_methods 
        SET is_default = FALSE, updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id 
        AND id != COALESCE(NEW.id, uuid_generate_v4())
        AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_single_default_payment_method
    BEFORE INSERT OR UPDATE ON payment_methods
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION enforce_single_default_payment_method();

-- Function to calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_total(p_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
    calculated_subtotal INTEGER;
    calculated_tax INTEGER;
    calculated_discount INTEGER;
    calculated_total INTEGER;
BEGIN
    -- Calculate subtotal from line items
    SELECT COALESCE(SUM(total_cents), 0)
    INTO calculated_subtotal
    FROM invoice_line_items
    WHERE invoice_id = p_invoice_id 
    AND type NOT IN ('tax', 'discount');
    
    -- Calculate tax
    SELECT COALESCE(SUM(total_cents), 0)
    INTO calculated_tax
    FROM invoice_line_items
    WHERE invoice_id = p_invoice_id 
    AND type = 'tax';
    
    -- Calculate discount (as positive value)
    SELECT COALESCE(SUM(ABS(total_cents)), 0)
    INTO calculated_discount
    FROM invoice_line_items
    WHERE invoice_id = p_invoice_id 
    AND type = 'discount';
    
    -- Calculate total
    calculated_total := calculated_subtotal + calculated_tax - calculated_discount;
    
    -- Update invoice
    UPDATE invoices
    SET 
        subtotal_cents = calculated_subtotal,
        tax_cents = calculated_tax,
        discount_cents = calculated_discount,
        total_cents = calculated_total,
        updated_at = NOW()
    WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage for billing
CREATE OR REPLACE FUNCTION record_billing_usage(
    p_tenant_id UUID,
    p_subscription_id UUID,
    p_usage_type VARCHAR(100),
    p_quantity DECIMAL(10,2),
    p_unit_cost_cents INTEGER,
    p_resource_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    usage_record_id UUID;
    current_date_val DATE := CURRENT_DATE;
    period_start DATE;
    period_end DATE;
BEGIN
    -- Get current billing period
    SELECT 
        DATE_TRUNC('month', current_period_start)::DATE,
        DATE_TRUNC('month', current_period_end)::DATE
    INTO period_start, period_end
    FROM subscriptions
    WHERE id = p_subscription_id;
    
    -- Insert usage record
    INSERT INTO billing_usage_records (
        tenant_id,
        subscription_id,
        usage_type,
        quantity,
        unit_cost_cents,
        total_cost_cents,
        usage_date,
        billing_period_start,
        billing_period_end,
        resource_id
    ) VALUES (
        p_tenant_id,
        p_subscription_id,
        p_usage_type,
        p_quantity,
        p_unit_cost_cents,
        p_quantity * p_unit_cost_cents,
        current_date_val,
        period_start,
        period_end,
        p_resource_id
    )
    ON CONFLICT (tenant_id, usage_type, usage_date, resource_id) 
    DO UPDATE SET
        quantity = billing_usage_records.quantity + EXCLUDED.quantity,
        total_cost_cents = billing_usage_records.total_cost_cents + EXCLUDED.total_cost_cents
    RETURNING id INTO usage_record_id;
    
    RETURN usage_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert this migration
INSERT INTO schema_migrations (version, checksum) 
VALUES ('007', md5('007_billing_system.sql'))
ON CONFLICT (version) DO NOTHING;