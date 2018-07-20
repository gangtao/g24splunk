# g24splunk
a Splunk customer data visualization to support `the Grammar of Graphics` based on https://antv.alipay.com/zh-cn/g2/3.x/index.html

# build
To build this app, run following command
```
cd app/appserver/static/visualizations/g2
export SPLUNK_HOME={your_splunk_home}
npm install
npm run build

```

# install
To install this app, just copy the whole app folder to `${SPLUNK_HOME}/etc/apps/{your_app_name}`
