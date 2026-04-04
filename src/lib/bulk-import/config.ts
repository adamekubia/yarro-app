// Entity type configurations for bulk import
// Column definitions, aliases, and required fields — scoped per entity type
// to prevent cross-entity alias collisions.

export type EntityType = 'properties' | 'tenants' | 'contractors'

export interface ColumnDef {
  key: string
  label: string
  required: boolean
  aliases: string[]
}

export interface EntityConfig {
  columns: ColumnDef[]
  rpcName: string
  label: string
  icon: string // Lucide icon name
}

export const ENTITY_CONFIGS: Record<EntityType, EntityConfig> = {
  properties: {
    rpcName: 'bulk_import_properties',
    label: 'Properties',
    icon: 'Building2',
    columns: [
      {
        key: 'address',
        label: 'Address',
        required: true,
        aliases: ['addr', 'street', 'property_address', 'location', 'property'],
      },
      {
        key: 'property_type',
        label: 'Property Type',
        required: false,
        aliases: ['type', 'prop_type', 'building_type'],
      },
      {
        key: 'city',
        label: 'City',
        required: false,
        aliases: ['town', 'area', 'region'],
      },
      {
        key: 'landlord_name',
        label: 'Landlord Name',
        required: false,
        aliases: ['ll_name', 'owner', 'owner_name', 'landlord'],
      },
      {
        key: 'landlord_phone',
        label: 'Landlord Phone',
        required: false,
        aliases: ['ll_phone', 'owner_phone', 'll_tel', 'll_mobile'],
      },
      {
        key: 'landlord_email',
        label: 'Landlord Email',
        required: false,
        aliases: ['ll_email', 'owner_email'],
      },
    ],
  },
  tenants: {
    rpcName: 'bulk_import_tenants',
    label: 'Tenants',
    icon: 'Users',
    columns: [
      {
        key: 'full_name',
        label: 'Full Name',
        required: true,
        aliases: ['name', 'tenant_name', 'tenant'],
      },
      {
        key: 'phone',
        label: 'Phone',
        required: true,
        aliases: ['tel', 'mobile', 'cell', 'ph', 'telephone', 'contact_number', 'phone_number'],
      },
      {
        key: 'email',
        label: 'Email',
        required: false,
        aliases: ['e_mail', 'email_address', 'mail'],
      },
      {
        key: 'property_address',
        label: 'Property Address',
        required: false,
        aliases: ['property', 'address', 'flat', 'unit', 'house'],
      },
      {
        key: 'role_tag',
        label: 'Role',
        required: false,
        aliases: ['role', 'type', 'tenant_type'],
      },
    ],
  },
  contractors: {
    rpcName: 'bulk_import_contractors',
    label: 'Contractors',
    icon: 'Wrench',
    columns: [
      {
        key: 'contractor_name',
        label: 'Contractor Name',
        required: true,
        aliases: ['name', 'company', 'business', 'trade_name', 'company_name'],
      },
      {
        key: 'contractor_phone',
        label: 'Phone',
        required: true,
        aliases: ['phone', 'tel', 'mobile', 'cell', 'contact'],
      },
      {
        key: 'contractor_email',
        label: 'Email',
        required: false,
        aliases: ['email', 'e_mail', 'mail'],
      },
      {
        key: 'categories',
        label: 'Categories',
        required: false,
        aliases: ['category', 'trade', 'trades', 'skill', 'skills', 'service', 'services', 'speciality'],
      },
      {
        key: 'service_areas',
        label: 'Service Areas',
        required: false,
        aliases: ['areas', 'cities', 'coverage', 'locations', 'regions'],
      },
    ],
  },
}
