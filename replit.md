# RFP Agent - Automated RFP Management Platform

## Overview

RFP Agent is a comprehensive automation platform designed to streamline the Request for Proposal (RFP) workflow. The system automatically discovers, analyzes, and manages RFPs from various government portals, leveraging AI to generate compliant proposals and handle submissions. The platform features a React-based frontend with a Node.js/Express backend, providing real-time monitoring and management of the entire RFP lifecycle from discovery to submission.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript running on Vite development server
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design system
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Radix UI primitives with custom theming and dark mode support
- **File Uploads**: Uppy.js integration with AWS S3 direct uploads

### Backend Architecture

- **Runtime**: Node.js with Express.js REST API
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection Pooling**: Neon Database serverless PostgreSQL with connection pooling
- **Web Scraping**: Puppeteer for automated portal scanning and data extraction
- **AI Integration**: OpenAI GPT-5 for document analysis, compliance checking, and proposal generation
- **Job Scheduling**: Node-cron for automated portal scanning and deadline monitoring
- **Email Notifications**: SendGrid integration for automated notifications

### Data Storage Solutions

- **Primary Database**: PostgreSQL hosted on Neon Database with the following key entities:
  - Users, Portals, RFPs, Proposals, Documents, Submissions
  - Audit logs and notifications for compliance tracking
  - JSONB fields for flexible storage of AI-generated content and metadata
- **File Storage**: Google Cloud Storage with custom ACL policies for document management
- **Schema Management**: Drizzle Kit for database migrations and schema evolution

### Authentication and Authorization

- **Object-Level Security**: Custom ACL (Access Control List) system for fine-grained permissions
- **File Access Control**: Google Cloud Storage with custom metadata-based access policies
- **Portal Authentication**: Stored credentials for automated login to government portals

### AI and Automation Services

- **Document Analysis**: AI-powered parsing of RFP documents to extract requirements and deadlines
- **Compliance Checking**: Automated risk assessment and compliance verification
- **Proposal Generation**: AI-driven content creation with customizable templates
- **Smart Submission**: Automated form filling and document submission to portals

### Monitoring and Notifications

- **Real-time Dashboard**: Live metrics and status updates
- **Automated Alerts**: Email and in-app notifications for deadlines and compliance issues
- **Activity Tracking**: Comprehensive audit logs for all system actions
- **Portal Status Monitoring**: Health checks and error detection for government portals

## External Dependencies

### Cloud Services

- **Neon Database**: Serverless PostgreSQL database hosting with automatic scaling
- **Google Cloud Storage**: Object storage for RFP documents and generated proposals
- **SendGrid**: Email delivery service for automated notifications and alerts

### AI and Machine Learning

- **OpenAI GPT-5**: Advanced language model for document analysis and proposal generation
- **Custom AI Workflows**: Document parsing, compliance analysis, and content generation pipelines

### AI-Powered Automation

- **Mastra Framework**: TypeScript AI agent framework with integrated workflow orchestration
  - **Workflows**: Document processing, RFP discovery, proposal generation, BonfireHub authentication, and master orchestration
  - **Agents**: 3-tier system with 1 Orchestrator, 3 Managers, and 7 Specialist agents
  - **Features**: Parallel execution, suspension/resume for 2FA, human-in-the-loop capabilities
- **Node-cron**: Scheduled job execution for automated portal scanning

### Development and Build Tools

- **Vite**: Fast development server and build tool for the frontend
- **Replit Integration**: Development environment with cartographer plugin for enhanced debugging
- **ESBuild**: Fast JavaScript bundler for production builds

### Frontend Libraries

- **TanStack Query**: Server state synchronization and caching
- **Radix UI**: Accessible component primitives
- **Uppy.js**: File upload handling with progress tracking
- **Wouter**: Lightweight routing solution

### Backend Frameworks

- **Express.js**: Web application framework for REST API
- **Drizzle ORM**: Type-safe database toolkit with query builder
- **Zod**: Runtime type validation and schema definition
