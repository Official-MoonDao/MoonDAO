// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library NFTURITemplateGenerator {
    function generateURITemplate(string memory tableName, string[] memory attributes) internal pure returns (string memory) {
        require(attributes.length > 0, "Attributes array cannot be empty");

        string memory base = "SELECT+json_object%28";
        string memory separator = "%2C+";
        string memory uriTemplate = base;

        // Required columns
        string[] memory requiredColumns = new string[](4);
        requiredColumns[0] = "id";
        requiredColumns[1] = "name";
        requiredColumns[2] = "description";
        requiredColumns[3] = "image";

        // Add required columns to the json_object
        for (uint256 i = 0; i < requiredColumns.length; i++) {
            uriTemplate = string.concat(
                uriTemplate,
                "%27",
                requiredColumns[i],
                "%27%2C+",
                requiredColumns[i]
            );

            if (i < requiredColumns.length - 1) {
                uriTemplate = string.concat(uriTemplate, separator);
            }
        }

        // Add attributes to the json_array within json_object
        uriTemplate = string.concat(uriTemplate, separator, "%27attributes%27%2C+json_array%28");

        for (uint256 j = 0; j < attributes.length; j++) {
            uriTemplate = string.concat(
                uriTemplate,
                "json_object%28%27trait_type%27%2C+%27",
                attributes[j],
                "%27%2C+%27value%27%2C+",
                attributes[j],
                "%29"
            );

            if (j < attributes.length - 1) {
                uriTemplate = string.concat(uriTemplate, separator);
            }
        }

        uriTemplate = string.concat(uriTemplate, "%29%29+FROM+", tableName, "+WHERE+id%3D");
        return uriTemplate;
    }
}