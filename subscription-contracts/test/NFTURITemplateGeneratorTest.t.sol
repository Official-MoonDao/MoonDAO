// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/tables/NFTURITemplateGenerator.sol";

contract NFTURITemplateGeneratorTest is Test {
    function testGenerateURITemplate() public {
        string memory tableName = "myTable";
        string[] memory attributes = new string[](6);
        attributes[0] = "location";
        attributes[1] = "discord";
        attributes[2] = "twitter";
        attributes[3] = "website";
        attributes[4] = "view";
        attributes[5] = "formId";

        string memory expectedURI = "SELECT+json_object%28%27id%27%2C+id%2C+%27name%27%2C+name%2C+%27description%27%2C+description%2C+%27image%27%2C+image%2C+%27attributes%27%2C+json_array%28json_object%28%27trait_type%27%2C+%27location%27%2C+%27value%27%2C+location%29%2C+json_object%28%27trait_type%27%2C+%27discord%27%2C+%27value%27%2C+discord%29%2C+json_object%28%27trait_type%27%2C+%27twitter%27%2C+%27value%27%2C+twitter%29%2C+json_object%28%27trait_type%27%2C+%27website%27%2C+%27value%27%2C+website%29%2C+json_object%28%27trait_type%27%2C+%27view%27%2C+%27value%27%2C+view%29%2C+json_object%28%27trait_type%27%2C+%27formId%27%2C+%27value%27%2C+formId%29%29%29+FROM+myTable+WHERE+id%3D";

        string memory uriTemplate = NFTURITemplateGenerator.generateURITemplate(tableName, attributes);
        assertEq(uriTemplate, expectedURI);
    }
}