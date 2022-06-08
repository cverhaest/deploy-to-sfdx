echo "Updating PATH"
export PATH=$PATH:/app

echo "Updating PATH to include Salesforce CLI ..."
export PATH=$PATH:/app/.local/share/sfdx/cli/bin/

// CVER - 20220607 - Removing automatic sfdx update
// echo "Updating Salesforce CLI plugin ..."
// Run instead: heroku run bash --app sfdxappwizard or heroku run bash --app sfdxappwizard-en, and then sfdx update
// sfdx update

echo "Creating local resources ..."
mkdir /app/tmp

echo "Completed!"