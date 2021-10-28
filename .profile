echo "Updating PATH"
export PATH=$PATH:/app

echo "Updating PATH to include Salesforce CLI ..."
# CVER - Added to prevent update of sfdx
#export PATH=$PATH:/app/.local/share/sfdx/cli/bin/

echo "Updating Salesforce CLI plugin ..."
# CVER - Added to prevent update of sfdx
#sfdx update

echo "Creating local resources ..."
mkdir /app/tmp

echo "Completed!"