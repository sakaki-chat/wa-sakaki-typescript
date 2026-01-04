import fs from 'fs';
import path from 'path';

import mysql from 'mysql2/promise';
import mysql, { ConnectionOptions } from 'mysql2';

const db:any = '../../private/mysql/

const access: ConnectionOptions = {
  user: 'owner',
  database: db,
};

const conn = mysql.createConnection(access);
