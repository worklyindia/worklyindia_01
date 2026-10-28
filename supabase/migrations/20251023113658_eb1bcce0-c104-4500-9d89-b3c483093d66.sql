-- Add comprehensive questions for all assessments with correct IDs

-- Add 7 more JavaScript questions (already has 3, making 10 total)
-- JavaScript ID: 83aa3bf1-27e3-44f4-ab0b-38cbb93f7b1c
INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer_index, explanation, difficulty, points, display_order) VALUES
('83aa3bf1-27e3-44f4-ab0b-38cbb93f7b1c', 'What will be the output of: console.log(typeof null)?', 'multiple_choice', 
'[{"text": "\"null\"", "value": "null"}, {"text": "\"object\"", "value": "object"}, {"text": "\"undefined\"", "value": "undefined"}, {"text": "\"number\"", "value": "number"}]'::jsonb, 
1, 'typeof null returns "object" due to a legacy bug in JavaScript that has been kept for backward compatibility.', 'easy', 1, 4),

('83aa3bf1-27e3-44f4-ab0b-38cbb93f7b1c', 'Which method is used to add elements to the end of an array?', 'multiple_choice',
'[{"text": "array.push()", "value": "push"}, {"text": "array.pop()", "value": "pop"}, {"text": "array.shift()", "value": "shift"}, {"text": "array.unshift()", "value": "unshift"}]'::jsonb,
0, 'push() adds one or more elements to the end of an array and returns the new length.', 'easy', 1, 5),

('83aa3bf1-27e3-44f4-ab0b-38cbb93f7b1c', 'What is a closure in JavaScript?', 'multiple_choice',
'[{"text": "A way to close browser windows", "value": "window"}, {"text": "A function with access to its outer scope", "value": "closure"}, {"text": "A method to end loops", "value": "loop"}, {"text": "A way to terminate programs", "value": "terminate"}]'::jsonb,
1, 'A closure is a function that has access to variables in its outer (enclosing) lexical scope, even after the outer function has returned.', 'medium', 1, 6),

('83aa3bf1-27e3-44f4-ab0b-38cbb93f7b1c', 'Which of the following is NOT a JavaScript data type?', 'multiple_choice',
'[{"text": "undefined", "value": "undefined"}, {"text": "number", "value": "number"}, {"text": "boolean", "value": "boolean"}, {"text": "float", "value": "float"}]'::jsonb,
3, 'JavaScript does not have a separate "float" data type. All numbers are of type "number" (which is a 64-bit floating point).', 'easy', 1, 7),

('83aa3bf1-27e3-44f4-ab0b-38cbb93f7b1c', 'What does the "async" keyword do in JavaScript?', 'multiple_choice',
'[{"text": "Makes a function synchronous", "value": "sync"}, {"text": "Makes a function return a Promise", "value": "promise"}, {"text": "Pauses code execution", "value": "pause"}, {"text": "Speeds up function execution", "value": "speed"}]'::jsonb,
1, 'The async keyword before a function makes it return a Promise. It allows the use of await inside the function.', 'medium', 1, 8),

('83aa3bf1-27e3-44f4-ab0b-38cbb93f7b1c', 'What is the difference between "==" and "===" in JavaScript?', 'multiple_choice',
'[{"text": "No difference", "value": "none"}, {"text": "== checks value only, === checks value and type", "value": "correct"}, {"text": "=== is faster", "value": "speed"}, {"text": "== is deprecated", "value": "deprecated"}]'::jsonb,
1, '== performs type coercion before comparison, while === (strict equality) compares both value and type without coercion.', 'easy', 1, 9),

('83aa3bf1-27e3-44f4-ab0b-38cbb93f7b1c', 'What is the event loop in JavaScript?', 'multiple_choice',
'[{"text": "A loop that handles events", "value": "loop"}, {"text": "The mechanism that handles asynchronous callbacks", "value": "correct"}, {"text": "A type of for loop", "value": "for"}, {"text": "An error handling mechanism", "value": "error"}]'::jsonb,
1, 'The event loop is the mechanism that allows JavaScript to perform non-blocking operations by offloading operations to the system kernel whenever possible.', 'hard', 1, 10);

-- Python Assessment (10 questions)  
-- Python ID: ee8db905-6ca3-4f4c-b93d-9ed722327664
INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer_index, explanation, difficulty, points, display_order) VALUES
('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'Which of the following is the correct way to create a list in Python?', 'multiple_choice',
'[{"text": "list = {1, 2, 3}", "value": "set"}, {"text": "list = [1, 2, 3]", "value": "correct"}, {"text": "list = (1, 2, 3)", "value": "tuple"}, {"text": "list = <1, 2, 3>", "value": "invalid"}]'::jsonb,
1, 'Lists in Python are created using square brackets []. Curly braces create sets, parentheses create tuples.', 'easy', 1, 1),

('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'What will len([1, 2, 3, 4, 5]) return?', 'multiple_choice',
'[{"text": "4", "value": "four"}, {"text": "5", "value": "correct"}, {"text": "15", "value": "sum"}, {"text": "Error", "value": "error"}]'::jsonb,
1, 'The len() function returns the number of items in a container. This list has 5 elements.', 'easy', 1, 2),

('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'What is the output of: print(type(5.0))?', 'multiple_choice',
'[{"text": "<class ''int''>", "value": "int"}, {"text": "<class ''float''>", "value": "correct"}, {"text": "<class ''number''>", "value": "number"}, {"text": "<class ''decimal''>", "value": "decimal"}]'::jsonb,
1, 'Numbers with decimal points are of type float in Python, even if the decimal part is .0', 'easy', 1, 3),

('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'Which keyword is used to create a function in Python?', 'multiple_choice',
'[{"text": "function", "value": "function"}, {"text": "def", "value": "correct"}, {"text": "func", "value": "func"}, {"text": "define", "value": "define"}]'::jsonb,
1, 'The "def" keyword is used to define functions in Python.', 'easy', 1, 4),

('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'What is a list comprehension in Python?', 'multiple_choice',
'[{"text": "A way to compress lists", "value": "compress"}, {"text": "A concise way to create lists", "value": "correct"}, {"text": "A method to sort lists", "value": "sort"}, {"text": "A type of loop", "value": "loop"}]'::jsonb,
1, 'List comprehensions provide a concise way to create lists based on existing lists or other iterables. Example: [x*2 for x in range(5)]', 'medium', 1, 5),

('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'What does the __init__ method do in a Python class?', 'multiple_choice',
'[{"text": "Deletes an object", "value": "delete"}, {"text": "Initializes a new object", "value": "correct"}, {"text": "Imports modules", "value": "import"}, {"text": "Ends the program", "value": "end"}]'::jsonb,
1, '__init__ is the constructor method that initializes newly created objects. It is automatically called when a new instance of a class is created.', 'medium', 1, 6),

('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'Which of the following is used to handle exceptions in Python?', 'multiple_choice',
'[{"text": "try-except", "value": "correct"}, {"text": "if-else", "value": "if"}, {"text": "switch-case", "value": "switch"}, {"text": "catch-throw", "value": "catch"}]'::jsonb,
0, 'Python uses try-except blocks to handle exceptions. Code that might raise an exception is placed in the try block.', 'medium', 1, 7),

('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'What is the difference between a list and a tuple in Python?', 'multiple_choice',
'[{"text": "Lists use [], tuples use ()", "value": "syntax"}, {"text": "Tuples are immutable, lists are mutable", "value": "correct"}, {"text": "No difference", "value": "none"}, {"text": "Lists are faster", "value": "speed"}]'::jsonb,
1, 'The key difference is mutability: lists can be modified after creation (mutable), while tuples cannot be changed once created (immutable).', 'medium', 1, 8),

('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'What does the "with" statement do in Python?', 'multiple_choice',
'[{"text": "Creates a loop", "value": "loop"}, {"text": "Manages resources and ensures cleanup", "value": "correct"}, {"text": "Imports modules", "value": "import"}, {"text": "Defines variables", "value": "variable"}]'::jsonb,
1, 'The "with" statement simplifies exception handling by encapsulating common preparation and cleanup tasks. It ensures proper resource management, especially for file operations.', 'medium', 1, 9),

('ee8db905-6ca3-4f4c-b93d-9ed722327664', 'What is a decorator in Python?', 'multiple_choice',
'[{"text": "A design pattern", "value": "pattern"}, {"text": "A function that modifies another function", "value": "correct"}, {"text": "A type of comment", "value": "comment"}, {"text": "A way to format code", "value": "format"}]'::jsonb,
1, 'A decorator is a function that takes another function and extends its behavior without explicitly modifying it. They use the @decorator_name syntax.', 'hard', 1, 10);

-- React Assessment (10 questions)
-- React ID: 177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1
INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer_index, explanation, difficulty, points, display_order) VALUES
('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'What is JSX in React?', 'multiple_choice',
'[{"text": "A programming language", "value": "language"}, {"text": "A syntax extension for JavaScript", "value": "correct"}, {"text": "A database", "value": "database"}, {"text": "A CSS framework", "value": "css"}]'::jsonb,
1, 'JSX (JavaScript XML) is a syntax extension for JavaScript that allows you to write HTML-like code in your JavaScript files. It makes React code more readable.', 'easy', 1, 1),

('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'Which hook is used to manage state in functional components?', 'multiple_choice',
'[{"text": "useEffect", "value": "effect"}, {"text": "useState", "value": "correct"}, {"text": "useContext", "value": "context"}, {"text": "useReducer", "value": "reducer"}]'::jsonb,
1, 'useState is the React hook that lets you add state to functional components. It returns a stateful value and a function to update it.', 'easy', 1, 2),

('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'What is the purpose of useEffect hook?', 'multiple_choice',
'[{"text": "To create side effects", "value": "create"}, {"text": "To perform side effects in function components", "value": "correct"}, {"text": "To delete components", "value": "delete"}, {"text": "To style components", "value": "style"}]'::jsonb,
1, 'useEffect lets you perform side effects in function components, such as data fetching, subscriptions, or manually changing the DOM.', 'medium', 1, 3),

('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'What are props in React?', 'multiple_choice',
'[{"text": "Component properties passed from parent to child", "value": "correct"}, {"text": "Global variables", "value": "global"}, {"text": "CSS styles", "value": "css"}, {"text": "Database connections", "value": "db"}]'::jsonb,
0, 'Props (properties) are arguments passed into React components. They are passed from parent to child components and are read-only.', 'easy', 1, 4),

('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'What is the virtual DOM in React?', 'multiple_choice',
'[{"text": "A copy of the real DOM kept in memory", "value": "correct"}, {"text": "A virtual machine", "value": "vm"}, {"text": "A database", "value": "db"}, {"text": "A server", "value": "server"}]'::jsonb,
0, 'The virtual DOM is a lightweight copy of the actual DOM kept in memory. React uses it to optimize rendering by only updating changed parts.', 'medium', 1, 5),

('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'What is the Context API used for?', 'multiple_choice',
'[{"text": "Managing global state", "value": "correct"}, {"text": "Making API calls", "value": "api"}, {"text": "Styling components", "value": "style"}, {"text": "Routing", "value": "routing"}]'::jsonb,
0, 'Context API provides a way to pass data through the component tree without having to pass props down manually at every level (global state management).', 'medium', 1, 6),

('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'What is prop drilling?', 'multiple_choice',
'[{"text": "Optimizing props", "value": "optimize"}, {"text": "Passing props through multiple levels unnecessarily", "value": "correct"}, {"text": "Deleting props", "value": "delete"}, {"text": "Creating new props", "value": "create"}]'::jsonb,
1, 'Prop drilling is the process of passing data from a parent component to deeply nested child components through multiple levels of intermediate components.', 'medium', 1, 7),

('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'What does React.memo do?', 'multiple_choice',
'[{"text": "Stores component in memory", "value": "memory"}, {"text": "Memoizes a component to prevent unnecessary re-renders", "value": "correct"}, {"text": "Creates a note", "value": "note"}, {"text": "Deletes old components", "value": "delete"}]'::jsonb,
1, 'React.memo is a higher order component that memoizes the result. It prevents re-rendering if props haven''t changed, improving performance.', 'hard', 1, 8),

('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'What is the key prop used for in React lists?', 'multiple_choice',
'[{"text": "To style list items", "value": "style"}, {"text": "To help React identify which items have changed", "value": "correct"}, {"text": "To sort the list", "value": "sort"}, {"text": "To delete items", "value": "delete"}]'::jsonb,
1, 'Keys help React identify which items have changed, are added, or are removed. They should be unique among siblings for efficient updates.', 'medium', 1, 9),

('177d4db8-9f4d-4fbe-8cbf-3d54d5b3fce1', 'What is the difference between controlled and uncontrolled components?', 'multiple_choice',
'[{"text": "No difference", "value": "none"}, {"text": "Controlled components store form data in React state", "value": "correct"}, {"text": "Uncontrolled components are faster", "value": "speed"}, {"text": "Controlled components use databases", "value": "db"}]'::jsonb,
1, 'In controlled components, form data is handled by React state. In uncontrolled components, form data is handled by the DOM itself.', 'hard', 1, 10);

-- SQL Assessment (10 questions)
-- SQL ID: edb4ac32-40ad-4a01-b3af-5221f0479413
INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer_index, explanation, difficulty, points, display_order) VALUES
('edb4ac32-40ad-4a01-b3af-5221f0479413', 'Which SQL statement is used to retrieve data from a database?', 'multiple_choice',
'[{"text": "GET", "value": "get"}, {"text": "SELECT", "value": "correct"}, {"text": "RETRIEVE", "value": "retrieve"}, {"text": "FETCH", "value": "fetch"}]'::jsonb,
1, 'SELECT is the SQL statement used to query and retrieve data from one or more tables in a database.', 'easy', 1, 1),

('edb4ac32-40ad-4a01-b3af-5221f0479413', 'What does the WHERE clause do in SQL?', 'multiple_choice',
'[{"text": "Filters records based on conditions", "value": "correct"}, {"text": "Sorts records", "value": "sort"}, {"text": "Groups records", "value": "group"}, {"text": "Joins tables", "value": "join"}]'::jsonb,
0, 'The WHERE clause is used to filter records and extract only those that fulfill a specified condition.', 'easy', 1, 2),

('edb4ac32-40ad-4a01-b3af-5221f0479413', 'Which JOIN returns all records from both tables?', 'multiple_choice',
'[{"text": "INNER JOIN", "value": "inner"}, {"text": "LEFT JOIN", "value": "left"}, {"text": "FULL OUTER JOIN", "value": "correct"}, {"text": "CROSS JOIN", "value": "cross"}]'::jsonb,
2, 'FULL OUTER JOIN returns all records when there is a match in either the left or right table, including unmatched records from both sides.', 'medium', 1, 3),

('edb4ac32-40ad-4a01-b3af-5221f0479413', 'What is a PRIMARY KEY in SQL?', 'multiple_choice',
'[{"text": "The first column in a table", "value": "first"}, {"text": "A unique identifier for each record", "value": "correct"}, {"text": "The most important data", "value": "important"}, {"text": "A password", "value": "password"}]'::jsonb,
1, 'A PRIMARY KEY is a column (or combination of columns) that uniquely identifies each row in a table. It cannot contain NULL values.', 'easy', 1, 4),

('edb4ac32-40ad-4a01-b3af-5221f0479413', 'What does the GROUP BY clause do?', 'multiple_choice',
'[{"text": "Groups rows with the same values", "value": "correct"}, {"text": "Sorts rows", "value": "sort"}, {"text": "Filters rows", "value": "filter"}, {"text": "Joins tables", "value": "join"}]'::jsonb,
0, 'GROUP BY groups rows that have the same values in specified columns into summary rows, often used with aggregate functions like COUNT, SUM, AVG.', 'medium', 1, 5),

('edb4ac32-40ad-4a01-b3af-5221f0479413', 'Which SQL function returns the number of rows?', 'multiple_choice',
'[{"text": "SUM()", "value": "sum"}, {"text": "COUNT()", "value": "correct"}, {"text": "NUMBER()", "value": "number"}, {"text": "ROWS()", "value": "rows"}]'::jsonb,
1, 'COUNT() is an aggregate function that returns the number of rows that match a specified criterion.', 'easy', 1, 6),

('edb4ac32-40ad-4a01-b3af-5221f0479413', 'What is a FOREIGN KEY?', 'multiple_choice',
'[{"text": "A key from another country", "value": "country"}, {"text": "A field that links to the primary key of another table", "value": "correct"}, {"text": "An external database", "value": "external"}, {"text": "A backup key", "value": "backup"}]'::jsonb,
1, 'A FOREIGN KEY is a field (or collection of fields) in one table that refers to the PRIMARY KEY in another table, creating a link between the two tables.', 'medium', 1, 7),

('edb4ac32-40ad-4a01-b3af-5221f0479413', 'What does the HAVING clause do?', 'multiple_choice',
'[{"text": "Filters rows before grouping", "value": "before"}, {"text": "Filters groups after GROUP BY", "value": "correct"}, {"text": "Sorts data", "value": "sort"}, {"text": "Joins tables", "value": "join"}]'::jsonb,
1, 'HAVING is used to filter groups created by GROUP BY, similar to WHERE but for aggregate results. WHERE filters rows, HAVING filters groups.', 'medium', 1, 8),

('edb4ac32-40ad-4a01-b3af-5221f0479413', 'What is an INDEX in SQL?', 'multiple_choice',
'[{"text": "A table of contents", "value": "contents"}, {"text": "A database object that improves query speed", "value": "correct"}, {"text": "A type of table", "value": "table"}, {"text": "A column name", "value": "column"}]'::jsonb,
1, 'An INDEX is a database object that improves the speed of data retrieval operations on a table, similar to an index in a book.', 'medium', 1, 9),

('edb4ac32-40ad-4a01-b3af-5221f0479413', 'What is a subquery?', 'multiple_choice',
'[{"text": "A small query", "value": "small"}, {"text": "A query nested inside another query", "value": "correct"}, {"text": "A fast query", "value": "fast"}, {"text": "A query with errors", "value": "error"}]'::jsonb,
1, 'A subquery is a query nested inside another SQL query. It can be used in SELECT, INSERT, UPDATE, or DELETE statements.', 'hard', 1, 10);

-- Problem Solving Assessment (10 questions)
-- Problem Solving ID: 8ee79fab-f703-4370-8a70-78e93d1e9c49
INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer_index, explanation, difficulty, points, display_order) VALUES
('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely Lazzies. Is this statement true?', 'multiple_choice',
'[{"text": "True", "value": "correct"}, {"text": "False", "value": "false"}, {"text": "Cannot be determined", "value": "cannot"}, {"text": "Depends on context", "value": "depends"}]'::jsonb,
0, 'This is a logical syllogism. If A⊆B and B⊆C, then A⊆C. The statement is true by transitive property.', 'easy', 1, 1),

('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'What comes next in the sequence: 2, 6, 12, 20, 30, ?', 'multiple_choice',
'[{"text": "38", "value": "38"}, {"text": "40", "value": "40"}, {"text": "42", "value": "correct"}, {"text": "44", "value": "44"}]'::jsonb,
2, 'The pattern is n(n+1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42', 'medium', 1, 2),

('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'A clock shows 3:15. What is the angle between the hour and minute hands?', 'multiple_choice',
'[{"text": "0 degrees", "value": "0"}, {"text": "7.5 degrees", "value": "correct"}, {"text": "15 degrees", "value": "15"}, {"text": "30 degrees", "value": "30"}]'::jsonb,
1, 'At 3:15, the minute hand is at 90° (pointing at 3), and the hour hand is at 97.5° (1/4 past 3). The angle is 7.5°.', 'hard', 1, 3),

('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'If you rearrange the letters "CIFAIPC" you would have the name of a(n):', 'multiple_choice',
'[{"text": "City", "value": "city"}, {"text": "Animal", "value": "animal"}, {"text": "Ocean", "value": "correct"}, {"text": "Country", "value": "country"}]'::jsonb,
2, 'Rearranging "CIFAIPC" gives "PACIFIC", which is an ocean.', 'medium', 1, 4),

('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'How many months have 28 days?', 'multiple_choice',
'[{"text": "1", "value": "one"}, {"text": "2", "value": "two"}, {"text": "12", "value": "correct"}, {"text": "11", "value": "eleven"}]'::jsonb,
2, 'All 12 months have at least 28 days. This is a classic riddle that tests attention to the question being asked.', 'easy', 1, 5),

('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'Which number should come next: 1, 1, 2, 3, 5, 8, ?', 'multiple_choice',
'[{"text": "11", "value": "11"}, {"text": "12", "value": "12"}, {"text": "13", "value": "correct"}, {"text": "10", "value": "10"}]'::jsonb,
2, 'This is the Fibonacci sequence where each number is the sum of the two preceding ones: 1+1=2, 1+2=3, 2+3=5, 3+5=8, 5+8=13', 'medium', 1, 6),

('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'If 5 machines can make 5 widgets in 5 minutes, how long would it take 100 machines to make 100 widgets?', 'multiple_choice',
'[{"text": "5 minutes", "value": "correct"}, {"text": "20 minutes", "value": "20"}, {"text": "100 minutes", "value": "100"}, {"text": "1 minute", "value": "1"}]'::jsonb,
0, 'Each machine makes 1 widget in 5 minutes. Therefore, 100 machines would make 100 widgets in 5 minutes (working in parallel).', 'hard', 1, 7),

('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'Which word does NOT belong: Apple, Banana, Carrot, Grape, Orange?', 'multiple_choice',
'[{"text": "Apple", "value": "apple"}, {"text": "Banana", "value": "banana"}, {"text": "Carrot", "value": "correct"}, {"text": "Grape", "value": "grape"}]'::jsonb,
2, 'Carrot is a vegetable, while all others are fruits. This tests categorical thinking.', 'easy', 1, 8),

('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?', 'multiple_choice',
'[{"text": "$0.10", "value": "10"}, {"text": "$0.05", "value": "correct"}, {"text": "$0.15", "value": "15"}, {"text": "$0.20", "value": "20"}]'::jsonb,
1, 'If the ball costs $0.05, the bat costs $1.05 (which is $1.00 more). Together they cost $1.10. Most people incorrectly answer $0.10.', 'hard', 1, 9),

('8ee79fab-f703-4370-8a70-78e93d1e9c49', 'What is the missing number: 3, 7, 15, 31, ?, 127', 'multiple_choice',
'[{"text": "47", "value": "47"}, {"text": "55", "value": "55"}, {"text": "63", "value": "correct"}, {"text": "71", "value": "71"}]'::jsonb,
2, 'The pattern is (2^n - 1): 2²-1=3, 2³-1=7, 2⁴-1=15, 2⁵-1=31, 2⁶-1=63, 2⁷-1=127', 'hard', 1, 10);