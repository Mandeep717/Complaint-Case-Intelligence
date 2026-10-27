import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve(process.env.DATABASE_PATH || './server/data/ps26264.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,passwordHash TEXT NOT NULL,role TEXT NOT NULL,bureauId TEXT,region TEXT,isActive INTEGER NOT NULL DEFAULT 1,createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS institutions(id TEXT PRIMARY KEY,aicteId TEXT UNIQUE NOT NULL,name TEXT NOT NULL,address TEXT NOT NULL,region TEXT NOT NULL,isActive INTEGER NOT NULL DEFAULT 1,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS complaints(id TEXT PRIMARY KEY,caseId TEXT UNIQUE NOT NULL,institutionId TEXT NOT NULL REFERENCES institutions(id),receivedAt TEXT NOT NULL,category TEXT NOT NULL,subject TEXT NOT NULL,description TEXT NOT NULL,bureauId TEXT NOT NULL,assignedOfficerId TEXT REFERENCES users(id),status TEXT NOT NULL,priority TEXT NOT NULL,expectedDisposalAt TEXT,lastActionAt TEXT NOT NULL,nextAction TEXT,createdBy TEXT NOT NULL REFERENCES users(id),analysisState TEXT NOT NULL DEFAULT 'pending',createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY,complaintId TEXT NOT NULL REFERENCES complaints(id),actionType TEXT NOT NULL,performedBy TEXT NOT NULL REFERENCES users(id),previousValue TEXT,newValue TEXT,remarks TEXT,createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS relationships(id TEXT PRIMARY KEY,pairKey TEXT UNIQUE NOT NULL,complaintA TEXT NOT NULL REFERENCES complaints(id),complaintB TEXT NOT NULL REFERENCES complaints(id),relationshipType TEXT NOT NULL DEFAULT 'potential_overlap',matchingSignals TEXT NOT NULL,similarityScore REAL,llmExplanation TEXT,reviewStatus TEXT NOT NULL DEFAULT 'pending',reviewedBy TEXT REFERENCES users(id),reviewedAt TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,recipientId TEXT NOT NULL REFERENCES users(id),type TEXT NOT NULL,complaintId TEXT REFERENCES complaints(id),relationshipId TEXT REFERENCES relationships(id),eventKey TEXT UNIQUE NOT NULL,message TEXT NOT NULL,readAt TEXT,createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS embeddings(complaintId TEXT PRIMARY KEY REFERENCES complaints(id),model TEXT NOT NULL,contentHash TEXT NOT NULL,vector TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS revoked_tokens(jti TEXT PRIMARY KEY,expiresAt INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS complaints_institution_status ON complaints(institutionId,status);
CREATE INDEX IF NOT EXISTS complaints_bureau_status ON complaints(bureauId,status);
CREATE INDEX IF NOT EXISTS complaints_due ON complaints(expectedDisposalAt);
CREATE INDEX IF NOT EXISTS relationships_review_created ON relationships(reviewStatus,createdAt);
CREATE INDEX IF NOT EXISTS actions_case_created ON actions(complaintId,createdAt);
CREATE INDEX IF NOT EXISTS notifications_user_read_created ON notifications(recipientId,readAt,createdAt);
`);
