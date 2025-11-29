module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### **4. Create Backend Files**

**backend/app.py** - Use the Flask code from the first artifact

**backend/requirements.txt**:
```
Flask==3.0.0
flask-cors==4.0.0
gunicorn==21.2.0
