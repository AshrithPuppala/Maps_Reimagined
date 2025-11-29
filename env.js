// create-env.js
// Run this file with: node create-env.js

const fs = require('fs');
const path = require('path');

const envContent = `# Delhi Scout AI - Environment Variables
# Created automatically by create-env.js

# Backend API URL - Your Render backend URL
REACT_APP_API_URL=https://integrated-lovp.onrender.com

# For local development, uncomment the line below:
# REACT_APP_API_URL=http://localhost:5000
`;

const envPath = path.join(__dirname, '.env');

// Check if .env already exists
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists!');
  console.log('📄 Current content:');
  console.log(fs.readFileSync(envPath, 'utf8'));
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('Do you want to overwrite it? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      fs.writeFileSync(envPath, envContent);
      console.log('✅ .env file updated successfully!');
      console.log('📍 Location:', envPath);
    } else {
      console.log('❌ Cancelled. .env file not modified.');
    }
    readline.close();
  });
} else {
  // Create new .env file
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('📍 Location:', envPath);
  console.log('\n📄 Content:');
  console.log(envContent);
  console.log('\n🚀 Next steps:');
  console.log('1. Restart your development server: npm start');
  console.log('2. Check browser console for "Using API URL: ..."');
  console.log('3. Test the Risk Analysis feature');
}
