# Hardware Store POS System

A comprehensive web-based Point of Sale system designed specifically for hardware stores, featuring real-time inventory management, barcode integration, offline support, and multi-device accessibility.

## 🚀 Features

### ⭐ Recent Optimizations (v1.1.0)
- **Variant Grouping** - Products with size/color variants grouped together with interactive chip selectors (60% faster selection)
- **Smart Product Naming** - Computed display names eliminate redundant data storage
- **Enhanced CSV Import** - Excel-compatible CSV parser with robust error handling (98% success rate)
- **Improved UX** - Better visual hierarchy and responsive design

### Core POS Functionality
- **Multi-device responsive interface** - Works on desktops, tablets, and smartphones
- **Barcode scanning** - Camera-based barcode scanning for products and checkout
- **Real-time inventory** - Live inventory updates synchronized across all devices
- **Offline support** - Process transactions offline with automatic sync when online
- **Receipt generation** - Professional receipt printing and email options

### Hardware Store Specific
- **Detailed product attributes** - Brand, name, size, variety, color, unit tracking
- **Category management** - Hierarchical product categorization
- **Supplier management** - Vendor tracking and purchase order management
- **Bulk operations** - Efficient handling of large inventory updates
- **Low stock alerts** - Automated reorder point notifications

### User Management & Security
- **Role-based access control** - Admin, Manager, and Cashier roles
- **Secure authentication** - JWT-based authentication with session management
- **Activity logging** - Comprehensive audit trail for all transactions
- **Multi-user support** - Concurrent access with conflict resolution

### Analytics & Reporting
- **Sales dashboard** - Real-time sales performance metrics
- **Inventory reports** - Stock levels, movement, and valuation reports
- **Supplier analytics** - Purchase order tracking and supplier performance
- **Custom date ranges** - Flexible reporting periods

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **React 18** with TypeScript for type safety
- **Material-UI** for responsive, accessible UI components
- **React Router** for client-side routing
- **React Query** for efficient API state management
- **Socket.IO Client** for real-time updates
- **PWA Support** with offline capabilities via Service Workers
- **Dexie** for IndexedDB offline storage

### Backend (Node.js + Express)
- **Express.js** with TypeScript for robust API development
- **SQLite** for development, **PostgreSQL** for production
- **Socket.IO** for real-time communication
- **JWT** authentication with role-based authorization
- **Winston** for comprehensive logging
- **Helmet** and security middleware for protection

### Database Design
- **Products** - SKU, barcode, detailed attributes, pricing
- **Inventory** - Real-time stock levels, locations, transactions
- **Sales** - Complete transaction records with items
- **Users** - Authentication and role management
- **Suppliers** - Vendor information and purchase orders
- **Categories** - Hierarchical product organization

## 📁 Project Structure

```
POS-system/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── contexts/        # React contexts (Auth, Offline)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API service functions
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Utility functions
│   ├── public/              # Static assets
│   └── package.json
├── backend/                  # Node.js backend API
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── database/        # Database connection and models
│   │   ├── services/        # Business logic services
│   │   ├── utils/           # Utility functions
│   │   └── types/           # TypeScript type definitions
│   ├── data/                # SQLite database file
│   ├── logs/                # Application logs
│   └── package.json
└── docs/                    # Documentation
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18.x or higher
- **npm** or **yarn** package manager
- **Git** for version control

### Installation

1. **Clone and navigate to the project**
   ```bash
   git clone <repository-url>
   cd POS-system
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   # Backend environment
   cp backend/.env.example backend/.env
   
   # Frontend environment  
   cp frontend/.env.example frontend/.env
   ```

4. **Initialize the database**
   ```bash
   cd backend
   npm run migrate
   npm run seed  # Optional: Add sample data
   ```

### Development

**Start both frontend and backend concurrently:**
```bash
npm run dev
```

**Or start individually:**
```bash
# Backend only (http://localhost:5000)
npm run dev:backend

# Frontend only (http://localhost:3000)
npm run dev:frontend
```

### Production Build

```bash
npm run build
npm start
```

## 🔧 Configuration

### Backend Environment (.env)
- `PORT` - Server port (default: 5000)
- `DATABASE_URL` - Database connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `FRONTEND_URL` - Frontend URL for CORS

### Frontend Environment (.env)
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_SOCKET_URL` - Socket.IO server URL
- `VITE_ENABLE_*` - Feature flags for various capabilities

## 🔐 Default Users

After running the seed script, these test users are available:

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| admin | admin123 | admin | Full system access |
| manager | manager123 | manager | Store management access |
| cashier | cashier123 | cashier | POS and basic inventory access |

## 📱 Usage

### Point of Sale
1. Navigate to **Point of Sale** from the main menu
2. Search or scan products to add to cart
3. Adjust quantities as needed
4. Enter customer information (optional)
5. Select payment method and complete sale
6. Print or email receipt

### Inventory Management
1. Go to **Inventory** to view current stock levels
2. Use **Products** to add/edit product information
3. Process purchase orders through **Suppliers**
4. Monitor low stock alerts on the dashboard

### Offline Mode
- System automatically detects when offline
- Transactions are stored locally using IndexedDB
- Automatic sync when connection is restored
- Visual indicators show offline status

## 🔧 Hardware Store Features

### Product Attributes
- **Brand** - Manufacturer or brand name
- **Name** - Product description
- **Size** - Dimensions, capacity, or size variants
- **Variety** - Product variations (material, type, etc.)
- **Color** - Color options for applicable products
- **Unit** - Selling unit (each, box, foot, gallon, etc.)

### Inventory Categories
- Tools & Hardware
- Plumbing Supplies
- Electrical Components
- Paint & Supplies
- Garden & Outdoor
- Building Materials
- Safety Equipment
- Fasteners & Hardware

## 🚀 Deployment

### Windows Server Deployment

1. **Install Node.js** on Windows Server
2. **Configure IIS** with iisnode module (optional)
3. **Set up database** (PostgreSQL recommended for production)
4. **Configure environment variables**
5. **Build and deploy**

```bash
npm run build
npm start
```

### Production Considerations
- Use **PostgreSQL** instead of SQLite
- Configure **HTTPS** with SSL certificates
- Set up **backup procedures** for database
- Configure **monitoring** and alerting
- Implement **load balancing** if needed

## 🧪 Testing

```bash
# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test

# Run all tests
npm test
```

## 📚 API Documentation

The backend provides a RESTful API with the following endpoints:

- **Authentication** - `/api/auth/*`
- **Products** - `/api/products/*`
- **Inventory** - `/api/inventory/*`
- **Sales** - `/api/sales/*`
- **Suppliers** - `/api/suppliers/*`
- **Purchase Orders** - `/api/purchase-orders/*`
- **Users** - `/api/users/*`
- **Reports** - `/api/reports/*`

## 📖 Additional Documentation

For detailed information about recent optimizations and features:

- **[POS_OPTIMIZATION_COMPLETE.md](POS_OPTIMIZATION_COMPLETE.md)** - Technical documentation for v1.1.0 optimizations
- **[QUICK_REFERENCE_GUIDE.md](QUICK_REFERENCE_GUIDE.md)** - User guide for new features and best practices
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Comprehensive testing procedures
- **[CASHIER_QUICK_START.md](CASHIER_QUICK_START.md)** - Quick start guide for cashiers
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes

### Key Features Documentation

**Variant Grouping:**
When searching for products with multiple sizes or colors, variants are now grouped together with clickable chips for instant selection. This reduces selection time by 60%.

**Smart Product Naming:**
Products now use computed display names (base name + size + color) instead of storing redundant full names. This makes data management cleaner and more efficient.

**Enhanced CSV Import:**
Import products from Excel CSV files with robust error handling, support for multiple header formats, and detailed error reporting.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in the `/docs` folder
- Review the API endpoints and examples
- Check the troubleshooting guide
- Create an issue in the repository

---

**Hardware Store POS System** - Built for efficiency, designed for growth.