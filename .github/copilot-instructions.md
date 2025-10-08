# Hardware Store POS System - Copilot Instructions

This is a comprehensive web-based Point of Sale system designed specifically for hardware stores.

## Project Architecture
- Frontend: React with TypeScript, Material-UI for responsive design
- Backend: Node.js with Express and TypeScript
- Database: SQLite for development, PostgreSQL for production
- Real-time: Socket.IO for live inventory updates
- Authentication: JWT with role-based access control
- Offline Support: Service Workers with IndexedDB
- Barcode: Web-based camera scanning
- Deployment: Windows Server ready

## Key Features
- Multi-device responsive interface (desktop, tablet, mobile)
- Comprehensive product management with hardware store attributes
- Real-time inventory tracking and synchronization
- Barcode scanning for products and checkout
- Supplier and purchase order management
- Offline transaction processing with sync
- Role-based user access (admin, manager, cashier)
- Sales analytics and reporting dashboard
- Receipt generation and payment processing

## Development Guidelines
- Use TypeScript for type safety
- Implement proper error handling and validation
- Follow security best practices for authentication
- Ensure responsive design for all screen sizes
- Implement comprehensive logging and monitoring
- Use environment variables for configuration
- Follow RESTful API design principles
- Implement proper database migrations

## Hardware Store Specific Features
- Product attributes: brand, name, size, variety, color, unit
- Category management for different hardware types
- Bulk inventory operations
- Supplier relationship management
- Purchase order tracking and receiving
- Low stock alerts and reorder points